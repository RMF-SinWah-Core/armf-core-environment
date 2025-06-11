#!/usr/bin/env node

import path from "path"
import fs from "fs"
import sp from "child_process"
import os from "os"
import { spawnProcess } from "./utility";

const [,,working,...instance] = process.argv;

const [argument, action] = (instance||[]).reduce((p:[string[],string[]],c)=>{
    if(p[1].length){
        p[1].push(c);return p;
    }
    p[c.startsWith("-")?0:1].push(c);
    return p;
},[[],[]])

const error = argument.indexOf("-e")>=0;
const quick = argument.indexOf("-q")>=0;
const skip  = argument.indexOf("-n")>=0?["node_modules",".git",path.basename(__dirname),"release"]:[];
const projOnly = argument.indexOf("-p")>=0;

function getFolders(working:string, projOnly?:boolean, skip?:string[]){
    return new Promise<string[]>(res=>{
        fs.readdir(working,(err, dir)=>{
            dir = skip?.length ? dir.filter(x=>skip.indexOf(x)<0) : dir;
            if(dir.length===0)return res([]);
            Promise.all(dir.map(u=>new Promise<string>(x=>{
                const d = path.join(working,u);
                fs.stat(d,(err, stat)=>{
                    if(stat?.isDirectory()){
                        return (projOnly ? fs.readFile(path.join(d,"package.json"),{encoding:"utf-8"},(err,jsd)=>{
                            if(err)return x("");
                            try{
                                JSON.parse(jsd);
                                x(d);
                            }catch(ex){
                                x("");
                            }
                        }) : x(d));
                    }
                    x("")
                });
            }))).then(k=>{
                res(k.filter(x=>x.length));
            })
        })

    })
}

getFolders(working,projOnly,skip).then(dir=>{
    (quick ? new Promise<number>(res=>{
        Promise.all(dir.map(x=>spawnProcess(action.slice(),{cwd:x}))).then(value=>{
            res(Math.max(...value));
        });
    }) : dir.map(x=>()=>spawnProcess(action.slice(),{cwd:x})).reduce((p:Promise<number>,c)=>new Promise(res=>{
        p.then(code=>{
            return code ? res(code) :c().then(res);
        }).catch(()=>res(1));
    }),Promise.resolve(0))).then(code=>{
        if(code) console.log("Error code is received",code);
        process.exit(error ? code : 0);
    })
    
});


