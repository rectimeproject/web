const Second = 1;
const Minute = Second * 60;
const Hour = Minute * 60;
const Day = Hour * 24;

export default function secondsToHumanReadable(seconds: number) {
  const out = new Array<[number, string]>();
  const nonZeroOut = new Array<[number, string]>();

  for (const {value, label} of [
    {label: "d", value: Day},
    {label: "h", value: Hour},
    {label: "m", value: Minute},
    {label: "s", value: Second}
  ]) {
    const count = Math.floor(seconds / value);
    seconds -= value * count;

    out.push([count, label]);
    if (count) {
      nonZeroOut.push([count, label]);
    }
  }
  let n = nonZeroOut;
  if (!nonZeroOut.length) {
    n = out.slice(out.length - 1);
  }
  return n.map(t => t.join(" ")).join(", ");
}
