"""Concurrent-session tests for booking capacity and pet overlap (ADR 0011, P-02 / P-03).

booking_capacity.test.sql proves the rules one statement at a time. This file
proves they hold when two real sessions race: the first session's mutation is
held open, the second is started and observed blocked on it (pg_blocking_pids),
then the first commits and the second's outcome is checked. Covers competing
confirmations for the last place, two places, one pet at two hosts, capacity
edits racing confirmations in both orders, and the stale-snapshot isolation
levels failing closed. (A cancellation only frees a place, so it takes no
listing lock: a confirmation racing it can at worst be refused, never overbook.) Refusals must never carry a
DETAIL describing someone else's booking.

Uses only the Python standard library and psql. Run it against a disposable,
seeded database, never the shared hosted project:
  npx supabase db reset
  python3 supabase/tests/booking_concurrency.test.py \
    --database-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
Local Docker alternative: --container supabase_db_petswap
"""
import argparse
import queue
import subprocess
import threading
import time

parser = argparse.ArgumentParser(description=__doc__)
target = parser.add_mutually_exclusive_group(required=True)
target.add_argument('--database-url')
target.add_argument('--container')
parser.add_argument('--database', default='postgres')
args = parser.parse_args()
command = (['docker', 'exec', '-i', args.container, 'psql', '-U', 'postgres', '-d', args.database]
           if args.container else ['psql', args.database_url])
command += ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate']

def sql(text, check=True):
    result = subprocess.run(command, input=text, text=True, capture_output=True, timeout=20)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result

def uid(kind, n):
    return f'{kind}000000-0000-4000-8000-{n:012}'

owner = '10000000-0000-4000-8000-000000000001'
other_owner = '10000000-0000-4000-8000-000000000002'
requester = '10000000-0000-4000-8000-000000000003'
listing = [uid('71', n) for n in (1, 2)]
pet = [uid('72', n) for n in (1, 2, 3)]
booking = [uid('73', n) for n in (1, 2, 3)]

def identity(actor):
    return f"set local role authenticated; select set_config('request.jwt.claims','{{\"sub\":\"{actor}\",\"role\":\"authenticated\"}}',true);"

def confirm(n):
    return f"update public.bookings set status='confirmed' where id='{booking[n]}';"

def reduce():
    return f"update public.listings set capacity=1 where id='{listing[0]}';"

def cleanup():
    sql(f"""begin; set local session_replication_role=replica;
        delete from public.bookings where id in {tuple(booking)};
        delete from public.listings where id in {tuple(listing)};
        delete from public.pets where id in {tuple(pet)}; commit;""")

def fixtures(capacity, same_pet=False, existing=False):
    cleanup()
    sql(f"""begin; set local session_replication_role=replica;
        insert into public.pets (id,owner_id,name,species) values
        ('{pet[0]}','{requester}','Race pet 1','dog'),
        ('{pet[1]}','{requester}','Race pet 2','dog'),
        ('{pet[2]}','{requester}','Race pet 3','dog');
        insert into public.listings (id,owner_id,title,location,description,capacity,accepted_pet_types,status) values
        ('{listing[0]}','{owner}','Race A','Test City','Race fixture',{capacity},array['dog']::public.pet_species[],'published'),
        ('{listing[1]}','{other_owner}','Race B','Test City','Race fixture',2,array['dog']::public.pet_species[],'published');
        insert into public.bookings (id,listing_id,pet_id,requester_id,status,start_date,end_date) values
        ('{booking[0]}','{listing[0]}','{pet[0]}','{requester}','pending',public.booking_today()+90,public.booking_today()+94),
        ('{booking[1]}','{listing[1] if same_pet else listing[0]}','{pet[0] if same_pet else pet[1]}','{requester}','pending',public.booking_today()+90,public.booking_today()+94);
        commit;""")
    if existing:
        sql(f"""begin; set local session_replication_role=replica;
            insert into public.bookings (id,listing_id,pet_id,requester_id,status,start_date,end_date) values
            ('{booking[2]}','{listing[0]}','{pet[2]}','{requester}','confirmed',public.booking_today()+90,public.booking_today()+94); commit;""")

def race(name, first_action, second_action, expected_error=None, second_actor=owner):
    """Hold the first real mutation open until pg_blocking_pids proves contention."""
    first = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    second = None
    lines = queue.Queue()
    def read_first():
        for line in first.stdout:
            lines.put(line.strip())
    threading.Thread(target=read_first, daemon=True).start()
    try:
        first.stdin.write('begin; ' + identity(owner) + first_action + '\n\\echo MUTATION_HELD\n')
        first.stdin.flush()
        while lines.get(timeout=15) != 'MUTATION_HELD':
            pass
        second = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        app = 'petswap_booking_race_' + str(second.pid)
        second.stdin.write(f"set application_name='{app}'; begin; " + identity(second_actor) + second_action + ' commit;\n')
        second.stdin.close()
        deadline = time.monotonic() + 15
        while True:
            blocked = sql(f"select exists(select 1 from pg_stat_activity where application_name='{app}' and cardinality(pg_blocking_pids(pid))>0);").stdout.strip()
            if blocked == 't':
                break
            if second.poll() is not None or time.monotonic() >= deadline:
                error = second.stderr.read() if second.poll() is not None else 'timed out waiting for contention'
                raise AssertionError('Second session did not contend on the first mutation: ' + error)
            time.sleep(0.05)
        first.stdin.write('commit;\n\\q\n')
        first.stdin.close()
        first.wait(timeout=15)
        second.wait(timeout=15)
        assert first.returncode == 0, first.stderr.read()
        error = second.stderr.read()
        if expected_error:
            assert second.returncode != 0 and expected_error in error, error
            assert 'DETAIL:' not in error, 'Private booking details were exposed'
        else:
            assert second.returncode == 0, error
        print('PASS ' + name, flush=True)
    finally:
        for process in (first, second):
            if process is not None and process.poll() is None:
                process.kill()
                process.wait(timeout=10)

def assert_state(statuses, capacity):
    actual = sql(f"select string_agg(status::text,',' order by id) from public.bookings where id in ('{booking[0]}','{booking[1]}'); select capacity from public.listings where id='{listing[0]}';").stdout.strip().splitlines()
    assert actual == [statuses, str(capacity)], actual

try:
    fixtures(1)
    race('one remaining place', confirm(0), confirm(1), 'PBC01')
    assert_state('confirmed,pending', 1)

    fixtures(2)
    race('two places accept both different pets', confirm(0), confirm(1))
    assert_state('confirmed,confirmed', 2)

    fixtures(2, same_pet=True)
    race('same pet across two hosts', confirm(0), confirm(1), 'PBP01', other_owner)
    assert_state('confirmed,pending', 2)

    fixtures(2, existing=True)
    race('confirmation wins over capacity reduction', confirm(0), reduce(), 'PBC01')
    assert_state('confirmed,pending', 2)

    fixtures(2, existing=True)
    race('capacity reduction wins over confirmation', reduce(), confirm(0), 'PBC01')
    assert_state('pending,pending', 1)

    fixtures(2, existing=True)
    for isolation in ('repeatable read', 'serializable'):
        for action in (confirm(0), reduce()):
            rejected = sql(f'begin isolation level {isolation}; ' + identity(owner) + action + ' commit;', check=False)
            assert rejected.returncode != 0 and '0A000' in rejected.stderr, rejected.stderr
    assert_state('pending,pending', 2)
    print('PASS stale-snapshot isolation levels fail closed', flush=True)
finally:
    cleanup()
