import { heic } from './encoder-eval/icodec/lib/node.js';
import fs from 'node:fs';

async function generate() {
  await heic.loadEncoder();
  const width = 128;
  const height = 128;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = (x / width) * 255;
      rgba[i + 1] = (y / height) * 255;
      rgba[i + 2] = 200;
      rgba[i + 3] = 255;
    }
  }

  const heicBytes = heic.encode({ data: rgba, width, height }, { quality: 80 });
  fs.writeFileSync('test-fixtures/test-gen.heic', heicBytes);
  console.log('Saved test-fixtures/test-gen.heic (' + heicBytes.length + ' bytes)');
}

generate().catch(console.error);
