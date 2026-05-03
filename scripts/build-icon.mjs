// images/icon.svg → images/icon.png 변환.
// VSCode 마켓플레이스 아이콘 규격은 128×128 PNG.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(here, '../images/icon.svg');
const pngPath = resolve(here, '../images/icon.png');

const svg = readFileSync(svgPath);
const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 128 },
});
const png = resvg.render().asPng();
writeFileSync(pngPath, png);
console.log(`built ${pngPath} (${png.length} bytes)`);
