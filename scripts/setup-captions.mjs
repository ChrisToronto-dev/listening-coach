import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const python=process.platform==='win32'?'python':'python3';
for(const [command,args] of [[python,['-m','venv','.venv']],[resolve('.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python'),['-m','pip','install','-r','scripts/requirements-captions.txt']]]){
 const result=spawnSync(command,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
}
