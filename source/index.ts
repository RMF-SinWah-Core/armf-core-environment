#!/usr/bin/env node

import fetch, { Headers } from "node-fetch"
import path from "path"
import fs from "fs"
import os from "os"
import { spawnProcess, getConfiguration, spawnOutput } from "./utility";
import { ARGUMENT, BASE_CONFIG } from "./definition";
import { randomUUID } from "crypto";

const VALID_COMMAND = ["install","list","help"] as const;
type ValidCommand = typeof VALID_COMMAND[number]




const StrProps = ["token","host","owner","repo","tag" ,"save"] as const
const BoolProps= ["all","download"] as const

type STR_PROPS = typeof StrProps[number];
type BOOL_PROPS= typeof BoolProps[number];

type CONFIG = BASE_CONFIG<ValidCommand,STR_PROPS,BOOL_PROPS>/*{
    token: string,
    host:string,
    owner:string,
    repo:string,
    tag:string
    argv:string[],
    command:ValidCommand
    clean:boolean
    all:boolean
}*/
type ASSETINFO =  {releaseName:string, downLoad:string, assetName:string}



function cmd(c:string){
    return (os.platform()==="win32")?`${c}.cmd`:c;
}
const argv = process.argv.slice(2);
    
const cmds = argv.splice(0,1)[0];
var aCommand = cmds ? VALID_COMMAND.reduce((p,c)=>{
    if(cmds.toLowerCase()===c.toLowerCase())p=c;
    return p;
},VALID_COMMAND[VALID_COMMAND.length-1]):null;


const defConfig:CONFIG ={
    argv:argv,
    command:aCommand||VALID_COMMAND[VALID_COMMAND.length-1],
    host:"https://api.github.com",
    owner: process.env.OWNER|| 'RMF-SinWah-Core',
    repo: process.env.REPO || 'armf-core-utility',
    tag: process.env.TAG ||  'development-build',
    token:"",
    save:"",
    all:false,download:false
}


var allAction:Partial<{[key in ValidCommand]: ARGUMENT<CONFIG>[]}>={};

allAction["install"] =[
    {name:"-token",alias:"-t", desc:"Github Personal acess token",argv:"PST TToken", defaultValue:process.env.ASTUTE_TOKEN,field:"token",type:"string" },
    {name:"-owner",alias:"-o", desc:"Asset repository's organization",argv:"organization name", defaultValue:defConfig.owner,field:"owner",type:"string"},
    {name:"-repo",alias:"-r", desc:"Asset repository",argv:"repository name", defaultValue:defConfig.repo,field:"repo",type:"string"},
    {name:"-tag",alias:"-t", desc:"Asset Deployment name",argv:"deployment name", defaultValue:defConfig.tag,field:"tag",type:"string"},
    {name:"-save",alias:"-s",desc:"remove all download upon installation complete",argv:"location where binary is stored",field:"save",type:"boolean"},
    {name:"", desc:"list of asset to be installed", argv:["asset name to be deployed"],field:"argv",type:"string"},
    {name:"-download",alias:"-d",desc:"no install",field:"download",type:"boolean"},
    {name:"-help",alias:"-h",desc:"Showing help",type:"boolean"}
]
allAction["list"] = [
    {name:"-token",alias:"-t", desc:"Github Personal acess token",argv:["PST TToken"], defaultValue:process.env.ASTUTE_TOKEN,field:"token",type:"string"},
    {name:"-owner",alias:"-o", desc:"Asset repository's organization",argv:["organization name"], defaultValue:defConfig.owner,field:"owner",type:"string"},
    {name:"-repo",alias:"-r", desc:"Asset repository",argv:["repository name"], defaultValue:defConfig.repo,field:"repo",type:"string"},
    {name:"-tag",alias:"-t", desc:"Asset Deployment name",argv:["deployment name"], defaultValue:defConfig.tag,field:"tag",type:"string"},
    {name:"-all",alias:"-a",desc:"show from all repo",field:"all",type:"string"},
    {name:"-help",alias:"-h",desc:"Showing help",type:"boolean"}
]
allAction["help"] = []

const dict:{[key:string]:string} = {
    "armf.database":"armf.open.database|armf.ext.database",
    "armf.stream"  :"armf.open.stream|armf.ext.stream",
    "armf.service" :"armf.open.service|armf.ext.service",
    "armf.security":"armf.rmf.security",
    "":"armf.rmf.sdks"
}

function getRepo(prefix:string){
    const key = Object.keys(dict).filter(x=>prefix.startsWith(x+"."))[0];
    return dict[key] || dict[""];
}

function getAssetList(config:CONFIG,repo?:string):Promise<{[key:string]:ASSETINFO}>{
    const actualRepo = (repo||config.repo).split("|");
    if(actualRepo.length!==1){
        return actualRepo.map(x=>()=>new Promise<{[key:string]:ASSETINFO}>(res=>{
            getAssetList(config,x ).then(ret=>{
                res(ret);
            }).catch(()=>res({}));
        })).reduce((p:Promise<{[key:string]:ASSETINFO}>,c)=>new Promise(res=>{
            p.then(a=>{
                c().then(e=>res(Object.assign(a,e)));
            })
            return p;
        }),Promise.resolve({}));
    }
    return new Promise((res,rej)=>{
        const  h = new Headers({
            accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28",
            'Authorization': `Bearer ${config.token}`
        });
        const url = `${config.host}/repos/${config.owner}/${actualRepo[0]}/releases?sort=updated&direction=desc`;
        fetch(url,{ headers: h, method:"get"}).then(r=>{
            if(Math.floor(r.status/100)===4){
                if(r.status===404)return rej("not found");
                return rej("not authorized");
            }
            r.json().then((e:any[])=>{
                var t=e.filter(x=>x.tag_name===config.tag).reduce((p:{[key:string]:{releaseName:string, downLoad:string, assetName:string}},c)=>{
                    var m :{name:string, url:string}[] = c.assets||[];
                    p = m.reduce((x,y)=>{
                        if(x[y.name])return x;
                        x[y.name.toLowerCase()] = {
                            releaseName:c.name, downLoad:y.url, assetName:y.name
                        }
                        return x;
                    },p)
                    return p;
                },{});
                res(t);
            });
        }).catch((ex)=>{
            console.error("unable to get asset");
            rej(ex);
        });
    });
}

function getAsset(config:CONFIG,meta: ASSETINFO){
    const h = new Headers({
        accept:"application/octet-stream", "X-GitHub-Api-Version":"2022-11-28",
        'Authorization': `Bearer ${config.token}`,"content-type":"application/json"
    });
    const temp = path.join(".","@"+randomUUID().toString());
    return new Promise<string>((res,rej)=>{
        fetch(meta.downLoad,{headers:h,method:"get"}).then(x=>{
            if(Math.floor(x.status/100)!==2)return rej("error downloading");
            console.log("SYTATUS",x.status)
            x.arrayBuffer().then(k=>{
                if(!k?.byteLength)return rej("unable to download")
                fs.mkdir(config.save || temp,{recursive:true},()=>{
                    console.log("installing ",meta.assetName);
                    if(meta.assetName.endsWith(".dev.tgz")){
                        meta.assetName = meta.assetName.substring(0,meta.assetName.length-8)+".tgz";
                    }
                    fs.writeFile(path.join(config.save||temp,meta.assetName.toLowerCase()),Buffer.from(k),(err)=>{
                        err && rej(err);
                        res(path.join(config.save||temp,meta.assetName).toLowerCase());
                    })
                });
            }).catch(rej);
        });
    });
}

function processArgv(config:CONFIG|null){
    if(config===null)return;
    
    switch(config.command){
        case "list":return (config.all? Object.values(dict) : [config.repo]).map(x=>()=>new Promise<{[key:string]:ASSETINFO}>(res=>{
            getAssetList(config,x).then(resp=>{
                res(resp);
            }).catch(()=>res({}));
        })).reduce((p:Promise<{[key:string]:ASSETINFO}>,c)=>{
            return new Promise(r=>{
                p.then(a=>{
                    c().then(x=>r(Object.assign(a,x)));
                })
            });
        },Promise.resolve({})).then(cfg=>{
            console.log(Object.values(cfg));
        });
        case "install":getAssetList(config).then(resp=>{
            const func : ((argv:[x:string,y:ASSETINFO] )=>boolean)|null = 
                config.argv.find(x=>x==="?dev") ?  (argv)=>argv[0].endsWith(".dev.tgz")  : (config.argv.find(x=>x==="?prod")?(argv)=>argv[0].endsWith(".tgz") && !argv[0].endsWith(".dev.tgz") : null  );
            var rep =  Object.entries(resp);
            var pro=Promise.resolve();
            if(func!==null){
                rep = rep.filter(func);
            }else{
                const repo = Object.keys((config.argv||[]).map(x=>getRepo(x)).reduce((p:{[ket:string]:number},c)=>{
                    if(c===config.repo)return p;
                    p[c]=(p[c]||0)+1;
                    return p;
                },{}));
                pro = new Promise<void>(res=>{ repo.map(a=>()=>new Promise<void>(res=>{
                        getAssetList(config,a).then(o=>{
                            resp = Object.assign(resp,o);
                            res();
                        }).catch(res);
                    })).reduce((p,c)=>new Promise<void>(Res=>{
                        p.finally(()=>{
                            c().finally(Res);
                        })
                    }),Promise.resolve()).finally(()=>{
                        rep = Object.entries(resp).filter(x=>config.argv.indexOf(x[0])>=0);
                        res();
                    })
                });
            }
            pro.finally(()=>{
                if(rep.length===0){
                    console.log("Available asset");
                    console.log(["?dev","?prod",...Object.keys(resp)].join(", "));
                    return;
                }
                const seq = rep.map(x=>()=>new Promise<string|null>(rr=>{
                    getAsset(config,x[1]).then(lib=>{
                        rr(lib?.length?(lib):null);
                    })
                }))
                seq.reduce((p:Promise<string[]>,c)=>new Promise((res,j)=>{
                    p.then((d)=>{
                        c().then(a=>{
                            if(a!==null)d.push(a);
                            res(d);
                        }).catch(j); 
                    }).catch(j)
                }),Promise.resolve([])).then((libs)=>{
                    libs.map(lib=>()=>new Promise<{[key:string]:string}>(res=>{
                        if(config.download)return res({});
                        spawnProcess([cmd("npm"),"install","--save-dev",  "./"+lib]).finally(()=>{

                            spawnOutput(["tar","xfO","./"+lib,"--wildcards","*age.json"]).then(data=>{
                                const x=JSON.parse(data);
                                
                                if(!config.save?.length){
                                    var dir = path.dirname(lib);
                                    if(dir.length){
                                        console.log("clearing",dir)
                                        return fs.rm(dir,{recursive:true}, ()=>res(x.devDependencies||{}));
                                    }else{
                                        res(x.devDependencies||{});
                                    }
                                }
                                res(x.devDependencies||{});
                            });
                        });
                    })).reduce((p,c)=>new Promise<{[key:string]:string}>(res=>{
                        p.then((x)=>{
                            c().then(a=>res(Object.assign(x,a)));
                        })
                    }),Promise.resolve({})).then((q)=>{
                        spawnProcess([cmd("npm"),"install","--save-dev",  ...Object.keys(q) ]).finally(()=>{
                            console.log("installed");
                        })
                    });
                })
            });
        })
    }
}
try{
    
    
    const config = getConfiguration<ValidCommand,STR_PROPS,BOOL_PROPS,CONFIG>(aCommand,allAction,defConfig,...argv);
    if(config===null)process.exit(0);
    processArgv(config)?.finally(()=>{

    })

}catch(ex){

}
