// US-D.5 gate proof: fails on purpose so `web-quality` goes red. Never merge.
describe('required-check gate proof', () => {
  it('fails on purpose', () => {
    expect(1).toBe(2);
  });
});
