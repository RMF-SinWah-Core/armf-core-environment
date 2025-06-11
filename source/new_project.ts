#!/usr/bin/env node

import fs from "fs"
import { calling, spawnProcess } from "./utility";
import path from "path";


const [,,pkg,version,desc] = process.argv;

(function(){
    fs.mkdir(path.join(pkg,"source"),{recursive:true},()=>{
        console.log(path.resolve(__dirname,"..","package.json"));
        fs.readFile(path.resolve(__dirname,"..","package.json"),{encoding:"utf-8"},(err,data)=>{
            const js = JSON.parse(data);
            delete js.dependencies;
            delete js.devDependencies;
            delete js.bin;
            js.name = pkg;
            js.version = version;
            js.description = desc;
            fs.writeFile(path.join(pkg,"package.json"),JSON.stringify(js,undefined,"  "),{encoding:"utf-8"},()=>{
                fs.copyFile(path.resolve(__dirname,"..","tsconfig.json"),path.join(pkg,"tsconfig.json"),()=>{
                    fs.writeFile(path.join(pkg,"source","index.ts"),"",()=>{})
                });
            })
        })
    })
})();