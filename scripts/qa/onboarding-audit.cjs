// Isolated UI fixture: real onboarding component, deterministic task-save adapter.
// This does not authenticate or contact the production database. Drive it via CUA.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '../..');
(async () => {
  const fixtures = {
    '@/lib/use-language': `export function useLanguage() { return new URLSearchParams(location.search).get('lang') || 'en'; }`,
    '@/hooks/use-tasks': `let calls=0; export function useCreateTask(){ return {mutateAsync: async task => {
      calls++; await new Promise(resolve=>setTimeout(resolve, 300));
      if(calls===2 && new URLSearchParams(location.search).get('fail')==='1') throw Error('Simulated second-save failure');
      window.dispatchEvent(new CustomEvent('fixture:saved',{detail:task})); return task;
    }}; }`,
  };
  const built = await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},
    stdin:{resolveDir:root,loader:'tsx',contents:`import React,{useEffect,useState} from 'react'; import {createRoot} from 'react-dom/client'; import {Toaster} from 'sonner'; import {OnboardingModal} from './src/components/app/onboarding-modal';
      localStorage.removeItem('fl.onboardingSeen');
      function Fixture(){const [saved,setSaved]=useState([]);useEffect(()=>{const handler=e=>setSaved(items=>[...items,e.detail]);window.addEventListener('fixture:saved',handler);return()=>window.removeEventListener('fixture:saved',handler)},[]);return <><h1>Isolated onboarding test</h1><p>No production data is used.</p><output aria-label="Saved tasks">{JSON.stringify(saved)}</output><OnboardingModal/><Toaster/></>;} createRoot(document.getElementById('root')).render(<Fixture/>);`},
    plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},args=>{if(fixtures[args.path])return{path:args.path,namespace:'fixture'};if(/supabase|resend|web-push/.test(args.path))throw Error('Unexpected backend import');});b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:fixtures[args.path],loader:'jsx',resolveDir:root}));}}],
  });
  http.createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');res.end(built.outputFiles[0].contents);}
    else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(fs.readFileSync(path.join(root,'../ui-audit-style.css')));}
    else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}
  }).listen(3108,'127.0.0.1',()=>console.log('Isolated UI fixture: http://localhost:3108/?fail=1'));
})();
