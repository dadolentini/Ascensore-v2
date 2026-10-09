import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

let outputDirectory='';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(),{
    name:'static-route-entries',
    apply:'build',
    configResolved(config){outputDirectory=resolve(config.root,config.build.outDir);},
    async closeBundle(){
      const html=await readFile(join(outputDirectory,'index.html'),'utf8');
      await Promise.all(['come-funziona','gli-algoritmi'].map(async route=>{
        const directory=join(outputDirectory,route);
        await mkdir(directory,{recursive:true});
        await writeFile(join(directory,'index.html'),html,'utf8');
      }));
    },
  }],
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 60000 },
});
