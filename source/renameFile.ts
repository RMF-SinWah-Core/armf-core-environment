#!/usr/bin/env node

import path from "path"
import fs from "fs"
import { replaceAll } from "./utility"
import { cwd } from "process";

const [,,target,source, dest, ...skip] = process.argv;

if(skip[0]==="#")skip.push("node_modules",".git");


if(!target || !source || !dest)process.exit(1);

const curr = process.cwd();

function process_inst( source:string, dest:string, base:string, toChange:string, final:string){
    return new Promise<void>(res=>{
        if(skip.length && skip.indexOf(base)>=0)return res();
        var nc = path.join(source,base),nt = path.join(dest,replaceAll( base,toChange,final));
        fs.stat(nc,(err, stat)=>{
            if(stat.isFile()){
                return fs.readFile(nc,{encoding:"utf-8"},(err, data)=>{
                    fs.writeFile(nt,replaceAll(data,toChange,final),{encoding:"utf-8"},(err)=>{
                        res();
                    })
                });
            }
            if(stat.isDirectory()){
                return fs.readdir(nc,(err, ls)=>{
                    ls.map(a=>()=>new Promise<void>(rr=>{
                        fs.mkdir(nt,()=>{
                            process_inst(nc,nt,a,toChange,final).finally(rr);
                        });
                    })).reduce((p:Promise<void>,c)=>new Promise<void>(res=>{
                        p.finally(()=>{
                            c().finally(res);
                        });
                    }),Promise.resolve()).finally(res);
                })
            }
            res();
        });
    })
}

console.log("replacing ",source,",", dest)
fs.mkdir(target,{recursive:true},(err, data)=>{
    fs.readdir(cwd(),(err, ls)=>{
        var nc = cwd(),nt = target;
        ls.map(a=>()=>new Promise<void>(rr=>{
            fs.mkdir(nt,()=>{
                process_inst(nc,nt,a,source,dest).finally(rr);
            });
        })).reduce((p:Promise<void>,c)=>{
            return new Promise(res=>{
                p.finally(()=>{
                    c().finally(res);
                })
            })
        },Promise.resolve())
    });
});