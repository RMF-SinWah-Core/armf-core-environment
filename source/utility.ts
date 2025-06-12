import {spawn} from "child_process"
import os from "os"
import path from "path"
import fs from "fs";
import { ARGUMENT, BASE_CONFIG } from "./definition";

export function calling(cmd:string){
    return os.platform()==="win32"?cmd+".cmd":cmd;
}

export function spawnProcess(command:string[], config?:{cwd?:string}){
    return new Promise<number>((res)=>{
        const action = command.splice(0,1);
        const env = {cwd:config?.cwd, env:process.env,stdio:"inherit" as const};
        const npm = os.platform()==="win32"?spawn("cmd.exe",["/c",...action,...command],env)
            : spawn(action[0],command,env);
        console.log("executing ",action, command)
        npm.on("close",(code)=>{
            console.log("EXIT CODE = "+code);
            res(code===null?-1:code);
        })
    });
}

export function spawnOutput(command:string[], config?:{cwd?:string}){
    return new Promise<string>((res)=>{
        const action = command.splice(0,1);
        var cmd:string[] = [];
        const env = {cwd:config?.cwd, env:process.env};
        const npm = os.platform()==="win32"?spawn("cmd.exe",["/c",...action,...command])
            : spawn(action[0],command,env);
        npm.stdout?.on("data",(msg)=>{
            cmd.push(msg.toString());
        })
        console.log("executing ",action, command)
        npm.on("close",(code)=>{
            setTimeout(()=>
            res(cmd.join("")),100);
        })
    });
}

export function copyFolder(root:string,target:string,rel:string){
    return new Promise<void>(Res=>{
        const ori =rel.length? path.join(root,rel):root;
        const tar =rel.length? path.join(target,rel):target;
        fs.stat(ori,(err, stat)=>{
            if(stat.isDirectory()){
                return fs.readdir(ori,(err, dir)=>{
                    if(dir.length===0)return Res();
                    return fs.mkdir(tar,{recursive:true},()=>{
                        Promise.all(dir.map(x=>new Promise<void>(res=>{
                            copyFolder(root,target,path.join(rel,x)).finally(res);
                        }))).finally(Res);
                    })
                });
            };
            if(stat.isFile()){
                return fs.copyFile(ori,tar,()=>{
                    Res();
                })
            }
            Res();
        })
    })
}

export function getConfiguration<S extends string, STR extends string,BOOL extends string, T extends BASE_CONFIG<S,STR,BOOL>>(command:S|null, allCommand:{[key:string]:ARGUMENT<T>[]}, defaultConfig:T , ...argv:string[]):T|null{
    var argvStart = 0;
    if(command===null){
        console.log("Astute Environment Setup");
        console.log("npm exec setup -- [ "+ Object.keys(allCommand).join(" | ")+" ]" );
        return null;
    }
    
    if(argvStart)argv=argv.slice(1);
    const action = allCommand[command]||[];
    defaultConfig=action.reduce((p,c)=>{
        if(!c.field && c.defaultValue)return p;
        
        (p as any)[c.field] = c.defaultValue;
        return p;
    },defaultConfig);
    console.log(defaultConfig);
    const help  = action.filter(x=>x.alias==="-h")||[];
    if(help.length){
        if(argv[0]===help[0].name || (argv[0]||"")===help[0].alias){
            console.log("Astute Environment Setup");
            const arr = action.reduce((p,c)=>Math.max(10,c.name.length,(c.alias||"").length),0 )+4;
            const withArgu = action.filter(x=>x.argv?.length && x.name.length);
            const noArgu = action.filter(x=>!x.argv?.length);

            const cmd1 = noArgu.map(a=>a.alias?`${a.name} | ${a.alias}`:a.name).join(" | ");
            const cmd2 = withArgu.map(a=>"[ ( "+(a.alias?`${a.name} | ${a.alias}`:a.name)+")"+` ${a.name.substring(1)}.inst ]`).join(" | ");
            const cmd3 = action.filter(x=>x.argv?.length && x.name==="")[0]
            console.log("npm exec setup -- "+command + " [ "+ [cmd1,cmd2,...(cmd3?[`...inst`]:[])].join(" | ")+  " ]" );

            action.forEach(x=>{
                var key = ("  "+x.name);
                if(x.name.length===0)return;
                if(x.alias){
                    console.log(key.padStart(arr)+" : "+(x.desc||"-"));
                    key = x.alias.padStart(arr," ");
                }
                console.log(key.padStart(arr)+" : "+(x.desc||"-"));
                if(x.argv?.length){
                    const cmt = Array.isArray(x.argv)?x.argv[0]:x.argv;
                    console.log(`${x.name.substring(1)}.inst`.padStart(arr)+" : "+cmt);
                }
                
            })
            if(cmd3){
                console.log("  ...instance  : "+cmd3.desc||"-")
            }
                
            return null;
        }
    }
    argvStart = 0;

    const lw = argv.map(x=>x.toLowerCase());
    const err = (action.reduce((p:string[],c)=>{
        if(c.type==="string" && c.field && !c.defaultValue && c.name.length){
            const msg = lw.indexOf(c.name.toLowerCase())>=0 || (!!c.alias && lw.indexOf(c.alias.toLowerCase())>=0 );
            if(!msg)p.push(c.name+ " is not provided");
        }
        if(c.type==="boolean"){
            c.defaultValue=!!c.defaultValue;
        }
        return p;
    },[]));
    if(err.length){
        err.forEach(x=>{
            console.error(x);
        })
        process.exit(1);
    }
    
    defaultConfig = argv.reduce((p,c,i, all)=>{
        var x =action.filter(k=>k.name.toLowerCase()===c.toLowerCase() || k.alias?.toLowerCase()===c.toLowerCase() )[0];
        if(x===null || !x?.name?.length){
            
            return p;
        }
        var P : any = p;
        argvStart = i+1;
        
        if(!x.argv){
            console.log("................",x.field);
            P[x.field]= true;
            return p;
        }
        var txt = all[i+1];
        if(txt===undefined){
            if(x.argv?.length){
                throw Error("default value not found");
            }
            return p;
        }
        if(x.field==="argv" || x.field==="command" || x.field===undefined){
            return p;
        }
        if(x.argv?.length)argvStart = i+2;
        const m = x.field;
        P[m]=txt;
        return p;
    },defaultConfig);
    var p = argv.slice(argvStart);
    defaultConfig.argv = p;
    return defaultConfig;

}

function escapeRegExp(str:string){
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

export function replaceAll(source:string, find:string, replace:string):string{
    return source.replace(new RegExp(escapeRegExp(find),"g"),replace);
}