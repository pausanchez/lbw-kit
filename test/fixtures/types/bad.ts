// Each line below is a misuse the types must reject. If one starts to compile, `tsc` fails on the unused directive.
// @ts-expect-error a number's bounds are numbers
LBW.widget('a', (p) => { p.num('n', '1', 10, 1); return null; });
// @ts-expect-error there is no ui.banner
LBW.ui.banner('x');
// @ts-expect-error fields are an object, not a string
LBW.say('hi', 'size=m');
// @ts-expect-error the render function returns an element or null, not a string
LBW.widget('b', () => 'text');
// @ts-expect-error a day number is not a string
LBW.day.str('21/11/2026');
// @ts-expect-error field values are strings
LBW.ui.reply('A', 'a', { fields: { n: 3 } });
// @ts-expect-error a loading shape is one of three
LBW.ui.loading('en', '', 'circle');
