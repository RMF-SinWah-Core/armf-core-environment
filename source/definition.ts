
export type PACKAGE = {
    name:string,
    version:string,
    dependencies?:{[key:string]:string},
    devDependencies?:{[key:string]:string},
    peerDependencies?:{[key:string]:string}
}
export type ARGUMENTSTR<T> = {

    name:string,
    argv?:string|[string]
    desc?:string,
    alias?:string,
    defaultValue?:string,
    field?:keyof T;
    type:"string"
}
export type ARGUMENTBOOL<T> = {
    
    name:string,
    argv?:string|[string]
    desc?:string,
    alias?:string,
    defaultValue?:boolean,
    field?:keyof T;
    type:"boolean"
}
export type ARGUMENT<T>=ARGUMENTBOOL<T>|ARGUMENTSTR<T>

export type BASE_CONFIG<CMD extends string | "help", STR extends string, BOOL extends string >  = //{[key:string]:string[]|string|boolean|CMD} 
     {argv:string[]} & {command:CMD} & {[key in  STR ]:string} & {[key in BOOL]:boolean}
    