import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import fileExists = require('file-exists');
import { Mutex, MutexInterface } from 'async-mutex';

interface FileMapping {
    header: string[]
    source: string[]
    name: string
}

const cacheMutex = new Mutex();
var fileCache: { [id: string]: string[] } = {};

export async function initCache() {
    cacheMutex.runExclusive(async () => {
        fileCache = {};

        let cfg = vscode.workspace.getConfiguration('headerSourceSwitch');
        let mappings = cfg.get<FileMapping[]>('mappings');

        let uris: vscode.Uri[] = await vscode.workspace.findFiles('**/*');
        for (const uri of uris) {
            let fsPath = path.normalize(uri.fsPath);
            let extension = path.extname(fsPath);

            for (let i = 0; i < mappings.length; i++) {
                let mapping = mappings[i];

                if (mapping.header.indexOf(extension) != -1 || mapping.source.indexOf(extension) != -1) {
                    // Extension present in a mapping, add to cache
                    let name = path.basename(fsPath).replace(extension, '');
                    if (name in fileCache) {
                        fileCache[name].push(fsPath);
                    } else {
                        fileCache[name] = [fsPath];
                    }
                    break;
                }
            }
        }
    }, 2);
}

export async function updateCache(uri:vscode.Uri, create:boolean) {
    cacheMutex.runExclusive(async () => {
        let cfg = vscode.workspace.getConfiguration('headerSourceSwitch');
        let mappings = cfg.get<FileMapping[]>('mappings');

        let fsPath = path.normalize(uri.fsPath);
        let extension = path.extname(fsPath);

        if (create) {
            for (let i = 0; i < mappings.length; i++) {
                let mapping = mappings[i];

                if (mapping.header.indexOf(extension) != -1 || mapping.source.indexOf(extension) != -1) {
                    // Extension present in a mapping, add to cache
                    let name = path.basename(fsPath).replace(extension, '');
                    if (name in fileCache) {
                        fileCache[name].push(fsPath);
                    } else {
                        fileCache[name] = [fsPath];
                    }
                    break;
                }
            }
        } else {
            let name = path.basename(fsPath).replace(extension, '');
            if (name in fileCache) {
                let index = fileCache[name].indexOf(fsPath);
                if (index > -1) {
                    fileCache[name].splice(index, 1);
                    if (fileCache[name].length === 0) delete fileCache[name];
                }
            }
        }
    }, 1);
}

function queryCache(file:string): Thenable<string[]> {
    return cacheMutex.runExclusive(async () => {
        let extension = path.extname(file);
        let name = path.basename(file).replace(extension, '');
        
        if (name in fileCache) return fileCache[name];
        return [];
    });
}

export function findMatchedFileAsync(currentFileName:string) : Thenable<string> {
    let dir = path.dirname(currentFileName);
    let extension = path.extname(currentFileName);

    // If there's no extension, then nothing to do
    if (!extension) 
    {
        return;
    }

    let fileWithoutExtension = path.basename(currentFileName).replace(extension, '');

    // Determine if the file is a header or source file.
    let extensions : string[] = null;

    let cfg = vscode.workspace.getConfiguration('headerSourceSwitch');
    let mappings = cfg.get<FileMapping[]>('mappings');

    for (let i = 0; i < mappings.length; i++) {
        let mapping = mappings[i];

        if (mapping.header.indexOf(extension) != -1) {
            extensions = mapping.source;
        } 
        else if (mapping.source.indexOf(extension) != -1) {
            extensions = mapping.header;
        }

        if (extensions) {
            console.log("Detected extension using map: " + mapping.name);
            break;
        }
    }
    
    if (!extensions) {
        console.log("No matching extension found");
        return;
    }

    let extRegex = "(\\" + extensions.join("|\\") + ")$";

    return new Promise<string>((resolve, reject) => {
        queryCache(currentFileName).then(paths => {
            let currentIndex = paths.indexOf(currentFileName);
            if (currentIndex > -1) paths.splice(currentIndex, 1);

            paths = paths.filter((value: string) => {
                return path.extname(value).match(extRegex) != undefined;
            });

            // Try to order the filepaths based on closeness to original file
            paths.sort((a: string, b: string) => {
                let aRelative = path.relative(currentFileName, a);
                let bRelative = path.relative(currentFileName, b);

                let aDistance = aRelative.split(path.sep).length;
                let bDistance = bRelative.split(path.sep).length;

                return aDistance - bDistance;
            });

            if (paths.length > 0) {
                resolve(paths[0]);
            } else {
                reject('no paths matching');
            }
        });
    });
}