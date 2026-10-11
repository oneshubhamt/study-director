/* Study Director @@SD_RELEASE@@ portable data worker. */
(()=>{var e=(new TextEncoder).encode("SDENC02\n"),t=(new TextEncoder).encode("SDKEY01\n"),r=(new TextEncoder).encode("Study Director backup protection verifier v2"),a=(e,t="BACKUP_ENCRYPTION_INVALID")=>Object.assign(new Error(e),{code:t}),n=(e,t,r)=>new DataView(e.buffer,e.byteOffset,e.byteLength).setBigUint64(t,BigInt(r));function i(e){if(!Number.isSafeInteger(e)||e<1||Math.ceil(e/1048576)>4294967294)throw a("Backup exceeds the authenticated format’s numeric or nonce range.");return 64+e+16*(Math.ceil(e/1048576)+1)}async function o(t){if(!(t instanceof Blob))throw a("A backup file is required.");let r=new Uint8Array(await t.slice(0,64).arrayBuffer());if(!e.every((e,t)=>r[t]===e))return null;if(64!==r.length)throw a("Encrypted backup header is truncated.");let n=new DataView(r.buffer),o=Number(n.getBigUint64(40));if(2!==r[8]||1!==r[9]||0!==r[10]||0!==r[11]||1048576!==n.getUint32(12)||6e5!==n.getUint32(16)||r.slice(48).some(Boolean))throw a("Encrypted backup parameters are unsupported.");if(i(o)!==t.size)throw a("Encrypted backup is truncated or has trailing data.");return{header:r,size:o,version:2}}async function s(e,t){if("secret"!==e?.type||"PBKDF2"!==e.algorithm?.name||e.extractable)throw a("Unlock backup protection first.","BACKUP_LOCKED");return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:t,iterations:6e5},e,{name:"HMAC",hash:"SHA-256",length:256},!1,["sign","verify"])}var l=/^backup-[a-f0-9-]{36}$/u;var c=new Uint32Array([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]),u=new Int32Array(c),p=class{constructor(){this.state=new Uint32Array([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]),this.block=new Uint8Array(64),this.words=new Int32Array(64),this.length=0,this.used=0,this.finished=!1}compress(e,t=0){let r=this.words,a=this.state;for(let a=0;a<16;a++){let n=t+(a<<2);r[a]=e[n]<<24|e[n+1]<<16|e[n+2]<<8|e[n+3]}for(let e=16;e<64;e++){let t=r[e-15],a=r[e-2];r[e]=((a>>>17|a<<15)^(a>>>19|a<<13)^a>>>10)+r[e-7]+((t>>>7|t<<25)^(t>>>18|t<<14)^t>>>3)+r[e-16]|0}let n=0|a[0],i=0|a[1],o=0|a[2],s=0|a[3],l=0|a[4],c=0|a[5],p=0|a[6],f=0|a[7];for(let e=0;e<64;e++){let t=f+((l>>>6|l<<26)^(l>>>11|l<<21)^(l>>>25|l<<7))+(l&c^~l&p)+u[e]+r[e]|0,a=((n>>>2|n<<30)^(n>>>13|n<<19)^(n>>>22|n<<10))+(n&i^n&o^i&o)|0;f=p,p=c,c=l,l=s+t|0,s=o,o=i,i=n,n=t+a|0}a[0]+=n,a[1]+=i,a[2]+=o,a[3]+=s,a[4]+=l,a[5]+=c,a[6]+=p,a[7]+=f}update(e){if(this.finished)throw new Error("Hash already finished.");this.length+=e.length;let t=0;if(this.used){let r=Math.min(64-this.used,e.length);this.block.set(e.subarray(0,r),this.used),this.used+=r,t=r,64===this.used&&(this.compress(this.block),this.used=0)}for(;t+64<=e.length;t+=64)this.compress(e,t);return t<e.length&&(this.block.set(e.subarray(t),0),this.used=e.length-t),this}hex(){if(this.finished)throw new Error("Hash already finished.");this.finished=!0;let e=this.block;e[this.used++]=128,this.used>56&&(e.fill(0,this.used),this.compress(e),this.used=0),e.fill(0,this.used,56);let t=new DataView(e.buffer);return t.setUint32(56,Math.floor(this.length/536870912)),t.setUint32(60,8*this.length>>>0),this.compress(e),Array.from(this.state,e=>e.toString(16).padStart(8,"0")).join("")}};async function f(e,t=()=>{}){if(e.size<=33554432&&globalThis.crypto?.subtle){let r=(e=>Array.from(new Uint8Array(e),e=>e.toString(16).padStart(2,"0")).join(""))(await crypto.subtle.digest("SHA-256",await e.arrayBuffer()));return t({loaded:e.size,total:e.size,phase:"verifying"}),r}let r=new p;for(let a=0;a<e.size;a+=1048576)r.update(new Uint8Array(await e.slice(a,a+1048576).arrayBuffer())),t({loaded:Math.min(a+1048576,e.size),total:e.size,phase:"verifying"});return r.hex()}var y=Object.freeze,h=4294967295,d=null;function m(e,t,r){e.setUint16(t,r,!0)}function w(e,t,r){e.setUint32(t,r>>>0,!0)}function g(e,t,r,a){let n=new Uint8Array(30+e.length),i=new DataView(n.buffer);return w(i,0,67324752),m(i,4,20),m(i,6,2048),m(i,8,0),m(i,10,a.time),m(i,12,a.date),w(i,14,t),w(i,18,r),w(i,22,r),m(i,26,e.length),m(i,28,0),n.set(e,30),n}function b(e,t,r,a,n){let i=new Uint8Array(46+e.length),o=new DataView(i.buffer);return w(o,0,33639248),m(o,4,20),m(o,6,20),m(o,8,2048),m(o,10,0),m(o,12,n.time),m(o,14,n.date),w(o,16,t),w(o,20,r),w(o,24,r),m(o,28,e.length),m(o,30,0),m(o,32,0),m(o,34,0),m(o,36,0),w(o,38,0),w(o,42,a),i.set(e,46),i}async function k(e){let t=4294967295,r=function(){if(d)return d;let e=new Uint32Array(256);for(let e=0;e<256;e++){let t=e;for(let e=0;e<8;e++)t=1&t?3988292384^t>>>1:t>>>1}return d=e,e}(),a=e=>{for(let a=0;a<e.length;a++)t=r[255&(t^e[a])]^t>>>8};if(e&&"function"==typeof e.stream){let t=e.stream().getReader();try{for(;;){let e=await t.read();if(e.done)break;a(e.value)}}finally{t.releaseLock?.()}}else a(new Uint8Array(await e.arrayBuffer()));return(4294967295^t)>>>0}var x=1048576;function B(e,t){if(e.byteLength!==t.byteLength)return!1;let r=e.byteLength>>>2,a=new Int32Array(e,0,r),n=new Int32Array(t,0,r);for(let e=0;e<r;e++)if(a[e]!==n[e])return!1;let i=new Uint8Array(e),o=new Uint8Array(t);for(let e=r<<2;e<i.length;e++)if(i[e]!==o[e])return!1;return!0}var A=Object.freeze({minSupportedSavedDate:"2025-01-01",importBytes:20971520,backupMaxCompressedBytes:134217728,backupMaxFileBytes:Number.MAX_SAFE_INTEGER,backupMaxAssetDescriptors:5e4,richAssetMaxBytes:12582912,attachmentPdfAudioMaxBytes:2147483648,richAssetMaxPerDocument:20,richAssetMaxBytesPerDocument:67108864,richAssetMaxAltChars:120,richAssetMaxDimensionPx:4096,richAssetMaxPixels:12582912,backupMaxUncompressedBytes:536870912,backupMaxEntryBytes:5242880,backupMaxLineBytes:16777216,backupChunkTargetBytes:524288,backupChunkItems:100,backupImportBatchSize:250,maxLegacyImportTombstones:3e4,maxBackupChunks:25e3,maxImportRecords:1e4,maxScheduleRows:160,maxTasksPerDay:160,maxScheduleChars:1e5,maxStudentNameChars:80,maxSearchChars:500,maxBackupFilenameChars:160,maxReflectionChars:7e4,maxQuoteChars:1e3,maxNoteChars:7e4,maxCarryForwardChars:1e4,maxRichTextWords:2e4,maxRichTextNodes:6e4,maxRichTextBytes:2097152,richRuntimeMaxRawBytes:342016,richRuntimeMaxGzipBytes:108544,maxOngoingNotes:2e3,areaNoteTrashDays:30,maxTaskNameChars:160,maxAreaNameChars:160,maxUnitChars:40,maxDurationMinutes:1440,maxStatusMessageChars:2e3,maxLiveSessionsPerTask:32,maxPauseEventsPerTask:96,maxPracticeRunsPerDay:24,maxPracticeUnitsPerRun:500,maxPracticeUnitsPerDay:512,maxPracticePlanGroups:32,maxPracticeMarksPerUnit:1e4,minPracticeTargetMs:5e3,maxPracticeTargetMs:864e5,localRescueBytes:4194304,fallbackDailyRecordsBytes:3145728,areaNoteRescueBytes:1048576,deletionRecoveryBytes:65536,storageWarningRatio:.8,storageCriticalRatio:.92});Object.freeze({fieldBoundaries:Object.freeze(["schedule","reflection","ongoingNote","richText","asset","backupEntry","backupLine"]),countBoundaries:Object.freeze(["dailyRecords","ongoingNotes","savedDayDeletions","assets"]),byteBoundaries:Object.freeze(["legacyImport","compressedBackup","uncompressedBackup","portableBackup"]),denseTextMetadata:Object.freeze({description:"Dense plain-text backup metadata without image assets or rich-document payloads.",dailyRecords:500,ongoingNotes:250,assetCount:0,averageTextBytes:8192})}),function(e=A){if(!Object.isFrozen(e))throw new TypeError("Production limits must be frozen.");for(let[t,r]of Object.entries(e))if("minSupportedSavedDate"!==t&&(!Number.isFinite(r)||r<=0))throw new TypeError(`Production limit ${t} is invalid.`);if(e.backupMaxCompressedBytes>e.backupMaxUncompressedBytes)throw new RangeError("Compressed backup limit exceeds the uncompressed safety limit.");if(e.backupMaxEntryBytes>e.backupMaxLineBytes)throw new RangeError("Backup entry limit exceeds the line limit.");if(e.backupMaxEntryBytes<=2*e.maxRichTextBytes)throw new RangeError("A maximum rich value could not fit one backup entry.")}(),A.maxRichTextNodes;var E=A.richAssetMaxAltChars;function S(e){return String(e??"").replace(/[\r\n\t]+/g," ").trim().slice(0,E)}function P(e){return"string"==typeof e&&(/^(?:https?:\/\/|mailto:|tel:)/i.test(e)||/^#attachment=(?:att|img)-[a-z0-9-]{20,80}$/.test(e))}function O(e){return e.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[e]||e))}function M(e){return e.replace(/([\\`*_[\]<>])/g,"\\$1")}function U(e){if("LineBreak"===e.type)return"  \n";if("SDImage"===e.type){let t=M(S(e.param?.alt||""));return`[Image${t?`: ${t}`:""}]`}if("SDAudio"===e.type)return`[Audio: ${M(String(e.param?.name||"Audio").trim()||"Audio")}]`;let t="Text"===e.type?M(String(e.param||"")):(e.content||[]).map(U).join(""),r=e.marks||{};return Object.prototype.hasOwnProperty.call(r,"Underline")&&(t=`<u>${t}</u>`),Object.prototype.hasOwnProperty.call(r,"Strikethrough")&&(t=`<s>${t}</s>`),Object.prototype.hasOwnProperty.call(r,"Subscript")&&(t=`<sub>${t}</sub>`),Object.prototype.hasOwnProperty.call(r,"Superscript")&&(t=`<sup>${t}</sup>`),Object.prototype.hasOwnProperty.call(r,"SDHighlight")&&(t=`<mark>${t}</mark>`),Object.prototype.hasOwnProperty.call(r,"Emphasis")&&(t=`*${t}*`),Object.prototype.hasOwnProperty.call(r,"Strong")&&(t=`**${t}**`),"string"==typeof r.Link&&P(r.Link)&&(t=`[${t}](${r.Link})`),t}function v(e){if("LineBreak"===e.type)return"<br>";let t="Text"===e.type?O(String(e.param||"")):(e.content||[]).map(v).join(""),r=e.marks||{};return Object.prototype.hasOwnProperty.call(r,"Underline")&&(t=`<u>${t}</u>`),Object.prototype.hasOwnProperty.call(r,"Strikethrough")&&(t=`<s>${t}</s>`),Object.prototype.hasOwnProperty.call(r,"Subscript")&&(t=`<sub>${t}</sub>`),Object.prototype.hasOwnProperty.call(r,"Superscript")&&(t=`<sup>${t}</sup>`),Object.prototype.hasOwnProperty.call(r,"SDHighlight")&&(t=`<mark>${t}</mark>`),Object.prototype.hasOwnProperty.call(r,"Emphasis")&&(t=`<em>${t}</em>`),Object.prototype.hasOwnProperty.call(r,"Strong")&&(t=`<strong>${t}</strong>`),"string"==typeof r.Link&&P(r.Link)&&(t=`<a href="${O(r.Link)}">${t}</a>`),t}function D(e){if("Paragraph"===e.type)return`<p>${(e.content||[]).map(v).join("")}</p>`;if("Heading"===e.type){let t=Math.max(1,Math.min(6,Number(e.param||1)));return`<h${t}>${(e.content||[]).map(v).join("")}</h${t}>`}if("Blockquote"===e.type)return`<blockquote>${(e.content||[]).map(D).join("")}</blockquote>`;if("HorizontalRule"===e.type)return"<hr>";if("BulletList"===e.type||"OrderedList"===e.type){let t="OrderedList"===e.type?"ol":"ul";return`<${t}${"OrderedList"===e.type&&1!==Number(e.param||1)?` start="${Math.max(1,Number(e.param||1))}"`:""}>${(e.content||[]).map(e=>`<li>${(e.content||[]).map(D).join("")}</li>`).join("")}</${t}>`}return(e.content||[]).map(D).join("")}function $(e){return(e.content||[]).map(e=>"Paragraph"===e.type?(e.content||[]).map(U).join(""):j(e).trim()).join("<br>").replace(/\r?\n/g,"<br>").replace(/\|/g,"\\|")}function j(e,t={},r=0){if("Paragraph"===e.type)return`${(e.content||[]).map(U).join("")}\n`;if("Heading"===e.type)return`${"#".repeat(Math.max(1,Math.min(6,Number(e.param||1))))} ${(e.content||[]).map(U).join("")}\n`;if("Blockquote"===e.type)return(e.content||[]).map(e=>j(e,t,r)).join("").trimEnd().split("\n").map(e=>`> ${e}`).join("\n")+"\n";if("HorizontalRule"===e.type)return"---\n";if("SDImage"===e.type){let r=e.param||{},a=M(S(r.alt||"")),n=t.assetPath?.(String(r.assetId||""))||"";return n?`![${a}](${n})\n`:`[Image unavailable${a?`: ${a}`:""}]\n`}if("SDAudio"===e.type)return`[Audio: ${M(String(e.param?.name||"Audio").trim()||"Audio")}]\n`;if("BulletList"===e.type||"OrderedList"===e.type){let a="BulletList"===e.type&&Object.prototype.hasOwnProperty.call(e.marks||{},"SDChecklist");return(e.content||[]).map((n,i)=>{let o=a?`[${!0===n.marks?.SDChecklistChecked?"x":" "}] `:"",s="OrderedList"===e.type?`${Number(e.param||1)+i}. `:"- ",l=(n.content||[]).map(e=>"Paragraph"===e.type?e.content?.map(U).join("")||"":j(e,t,r+1).trimEnd()).join("\n");return`${"  ".repeat(r)}${s}${o}${l}\n`}).join("")}if("Table"===e.type){let t=e.content||[];if(!t.length)return"";if((t[0]?.content||[]).every(e=>"HeaderCell"===e.type)){let e=t.map(e=>(e.content||[]).map($)),r=e[0].length;return`| ${e[0].join(" | ")} |\n| ${Array.from({length:r},()=>"---").join(" | ")} |\n`+e.slice(1).map(e=>`| ${e.join(" | ")} |\n`).join("")}return`<table>\n<tbody>\n${t.map(e=>`<tr>${(e.content||[]).map(e=>`<td>${function(e){return(e.content||[]).map(D).join("")}(e)}</td>`).join("")}</tr>`).join("\n")}\n</tbody>\n</table>\n`}return(e.content||[]).map(e=>j(e,t,r)).join("")}var z=function(c=()=>{throw new Error("Markdown renderer unavailable.")}){let u=new Map,p=0,d=e=>(new TextEncoder).encode(e);async function A(e,t="sha256"){let r=e instanceof Blob?new Uint8Array(await e.arrayBuffer()):d("string"==typeof e?e:JSON.stringify(e));if("fnv1a32"===t){let e=2166136261;for(let t of r)e^=t,e=Math.imul(e,16777619)>>>0;return e.toString(16).padStart(8,"0")}if("sha256"!==t)throw new Error("Unsupported backup checksum algorithm.");return[...new Uint8Array(await crypto.subtle.digest("SHA-256",r))].map(e=>e.toString(16).padStart(2,"0")).join("")}async function*E(e,{gzip:t,maxBytes:r,maxLineBytes:a}){let n=e.stream();t&&(n=n.pipeThrough(new DecompressionStream("gzip")));let i=n.getReader(),o=new TextDecoder,s="",l=0,c=0;try{for(;;){let e=await i.read();if(e.done)break;if(l+=e.value.byteLength,l>r)throw new Error(`Backup expands beyond the ${Math.round(r/1048576)} MB safe uncompressed limit.`);for(s+=o.decode(e.value,{stream:!0});;){let e=s.indexOf("\n");if(e<0)break;let t=s.slice(0,e).replace(/\r$/,"");if(s=s.slice(e+1),d(t).length>a)throw new Error("Backup contains an oversized chunk line.");c++,t.trim()&&(yield{value:JSON.parse(t),uncompressedBytes:l,lines:c})}if(d(s).length>a)throw new Error("Backup contains an oversized or unterminated chunk line.")}if(s+=o.decode(),s.trim()){if(d(s).length>a)throw new Error("Backup contains an oversized final line.");yield{value:JSON.parse(s),uncompressedBytes:l,lines:++c}}}finally{try{await i.cancel()}finally{i.releaseLock()}}}return Object.freeze({run:async function(S,P={},O=()=>{}){if("function"!=typeof O&&(O=()=>{}),"file.copy"===S||"crypto.stream.encrypt"===S||"crypto.stream.decrypt"===S){let t=await async function(e){let t=await async function(e){if("opfs"!==e?.kind)return e;let t=String(e.name||"");if(!l.test(t))throw new Error("Backup scratch-file identity is invalid.");let r=globalThis.navigator?.storage;if(!r||"function"!=typeof r.getDirectory)throw new Error("Browser file storage is unavailable to the file worker.");return(await(await r.getDirectory()).getDirectoryHandle("@@SD_BACKUP_FILES_OPFS_DIRECTORY@@",{create:!0})).getFileHandle(t,{create:!0})}(e);if(!t||"function"!=typeof t.getFile||"function"!=typeof t.createSyncAccessHandle&&"function"!=typeof t.createWritable)throw new Error("Backup file output is unavailable.");let r=null,a=null,n=0,i=!1;return"function"==typeof t.createSyncAccessHandle?r=await t.createSyncAccessHandle():a=await t.createWritable({keepExistingData:!1}),r&&r.truncate(0),{async write(e){if(i)throw new Error("File output is closed.");if(r){let t=0;for(;t<e.byteLength;){let a=r.write(e.subarray(t),{at:n});if(a<=0)throw new Error("File output made no progress.");t+=a,n+=a}}else await a.write(e),n+=e.byteLength},async close(){if(!i)if(i=!0,r)try{r.flush()}finally{r.close()}else await a.close()},async abort(){if(!i)if(i=!0,r)try{r.truncate(0)}finally{r.close()}else await a.abort()},file:()=>t.getFile(),get size(){return n}}}(P.output);try{return"file.copy"===S?await async function(e,t,r=()=>{}){for(let a=0;a<e.size;a+=1048576){let n=new Uint8Array(await e.slice(a,a+1048576).arrayBuffer());await t.write(n),r({loaded:Math.min(a+n.length,e.size),total:e.size,phase:"copying"})}}(P.file,t,O):await async function(t,r,s,{decrypt:l=!1,progress:c=()=>{},check:u=()=>{}}={}){let p,f=t.size;if(l){let e=await o(t);if(!e)throw a("Not a streaming encrypted backup.");({header:p,size:f}=e)}else{i(f),p=new Uint8Array(64),p.set(e),p[8]=2,p[9]=1;let t=new DataView(p.buffer);t.setUint32(12,1048576),t.setUint32(16,6e5),p.set(crypto.getRandomValues(new Uint8Array(16)),20),p.set(crypto.getRandomValues(new Uint8Array(4)),36),n(p,40,f)}let y=await async function(e,t){if("secret"!==e?.type||"PBKDF2"!==e.algorithm?.name||e.extractable)throw a("Unlock backup protection first.","BACKUP_LOCKED");return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:t.slice(20,36),iterations:6e5},e,{name:"AES-GCM",length:256},!1,["encrypt","decrypt"])}(r,p);u(),l||await s.write(p);let h=Math.ceil(f/1048576)+1,d=e=>Math.max(0,Math.min(1048576,f-1048576*e)),m=async e=>{let r=d(e),i=(e=>(l?64+16*e:0)+Math.min(1048576*e,f))(e),o=new Uint8Array(await t.slice(i,i+r+(l?16:0)).arrayBuffer());try{return new Uint8Array(await crypto.subtle[l?"decrypt":"encrypt"](function(e,t,r,a){let i=new Uint8Array(12);i.set(e.slice(36,40)),n(i,4,t);let o=new Uint8Array(77);return o.set(e),n(o,64,t),new DataView(o.buffer).setUint32(72,r),o[76]=a?1:0,{name:"AES-GCM",iv:i,additionalData:o,tagLength:128}}(p,e,r,e===h-1),y,o))}catch(e){throw l&&"OperationError"===e.name?a("The password is incorrect or the encrypted backup is damaged.","BACKUP_AUTH_FAILED"):e}finally{o.fill(0)}},w=[],g=0,b=0;try{for(let e=0;e<h;e++){for(u();w.length<4&&g<h;){let e=m(g++);e.catch(()=>{}),w.push(e)}let t=await w.shift();try{u(),await s.write(t)}finally{t.fill(0)}b+=d(e),c({loaded:b,total:f,phase:l?"decrypting":"encrypting"})}}finally{for(let e of await Promise.allSettled(w))e.value?.fill(0)}if(l&&64+f+16*h!==t.size)throw a("Encrypted backup has trailing data.");return l?f:i(f)}(P.file,P.key,t,{decrypt:S.endsWith(".decrypt"),progress:O}),await t.close(),await t.file()}catch(e){throw await t.abort().catch(()=>{}),e}}if("crypto.info"===S)return o(P.file);if("crypto.key"===S)return async function(e){if("string"!=typeof e||!e.length||e.length>1024)throw a("Enter a password of 1–1024 characters.");let t=(new TextEncoder).encode(e);try{return await crypto.subtle.importKey("raw",t,"PBKDF2",!1,["deriveKey"])}finally{t.fill(0)}}(P.password);if("crypto.verifier.create"===S)return async function(e){let a=new Uint8Array(32);a.set(t),a[8]=1,a[9]=1,new DataView(a.buffer).setUint32(12,6e5),a.set(crypto.getRandomValues(new Uint8Array(16)),16);let n=await s(e,a.slice(16,32)),i=new Uint8Array(await crypto.subtle.sign("HMAC",n,r));return new Blob([a,i],{type:"application/octet-stream"})}(P.key);if("crypto.verifier.check"===S)return async function(e,n){if(!(e instanceof Blob)||64!==e.size)throw a("Backup encryption settings are unreadable.");let i=new Uint8Array(await e.arrayBuffer());if(!t.every((e,t)=>i[t]===e)||1!==i[8]||1!==i[9]||0!==i[10]||0!==i[11]||6e5!==new DataView(i.buffer).getUint32(12))throw a("Backup encryption settings are unreadable.");let o=await s(n,i.slice(16,32));if(!await crypto.subtle.verify("HMAC",o,i.slice(32),r))throw a("The password is incorrect.","BACKUP_AUTH_FAILED");return!0}(P.file,P.key);if("file.hash"===S)return f(P.file,O);if("checksum"===S)return P.value instanceof Blob?f(P.value,O):A(P.value,P.algorithm);if("checksum.ranges"===S){let e=Array.isArray(P.ranges)?P.ranges:[],t=e[0]?.start,r=e.at(-1)?.end;if(!(P.file instanceof Blob)||!e.length||!Number.isSafeInteger(t)||!Number.isSafeInteger(r)||t<0||r>P.file.size||r-t>16777216||e.some((a,n)=>!(a.start>=t&&a.end>=a.start&&a.end<=r&&(!n||a.start>=e[n-1].end))))throw new Error("Checksum ranges are invalid.");let a=await P.file.slice(t,r).arrayBuffer();return O({loaded:r-t,total:r-t,phase:"verifying"}),Promise.all(e.map(async e=>(e=>Array.from(new Uint8Array(e),e=>e.toString(16).padStart(2,"0")).join(""))(await crypto.subtle.digest("SHA-256",new Uint8Array(a,e.start-t,e.end-e.start)))))}if("stringify"===S)return JSON.stringify(P.value);if("chunk"===S){let e={seq:P.seq,entityType:P.entityType,items:P.items},t=await A(e,P.algorithm),r=JSON.stringify({type:"chunk",...e,count:e.items.length,checksum:t});if(d(r).length>P.maxLineBytes)throw new Error("A backup chunk exceeds the safe line-size limit.");return{line:r,checksum:t}}if("parseBlob"===S){if(P.file.size>P.maxBytes)throw new Error("Legacy JSON backup is too large.");let e=await P.file.text();if(d(e).length>P.maxBytes)throw new Error("Legacy JSON backup exceeds the safe in-memory limit after reading.");return JSON.parse(e)}if("decode.open"===S){let e=++p;return u.set(e,{iterator:E(P.file,P)[Symbol.asyncIterator]()}),e}if("decode.next"===S){let e=u.get(P.id);if(!e)throw new Error("Backup reader expired.");let t=await e.iterator.next();return t.done&&u.delete(P.id),t}if("decode.close"===S){let e=u.get(P.id);return u.delete(P.id),await(e?.iterator.return()),!0}if("encode.open"===S){let e=P.gzip?new CompressionStream("gzip"):new TransformStream,t=++p,r={writer:e.writable.getWriter(),bytes:0,maxBytes:P.maxBytes};return r.result=(async()=>{let t=e.readable.getReader(),a=[],n=0;try{for(;;){let e=await t.read();if(e.done)break;if(n+=e.value.byteLength,n>r.maxBytes)throw new Error("Backup exceeds the safe compressed-size limit.");a.push(e.value)}return new Blob(a)}finally{await t.cancel().catch(()=>{}),t.releaseLock()}})(),r.result.catch(()=>{}),u.set(t,r),t}if("encode.write"===S){let e=u.get(P.id);if(!e)throw new Error("Backup writer expired.");return await e.writer.write(d(P.line)),!0}if("encode.finish"===S){let e=u.get(P.id);if(!e)throw new Error("Backup writer expired.");try{return await e.writer.close(),await e.result}finally{u.delete(P.id)}}if("encode.close"===S){let e=u.get(P.id);return u.delete(P.id),await(e?.writer.abort().catch(()=>{})),!0}if("markdown"===S)return c(P.doc,P.text,{assetPath:e=>P.paths[e]||""});if("zip"===S)return async function(e,t){if(!Array.isArray(e)||!e.length)throw new TypeError("ZIP export requires at least one file.");if(e.length>65535)throw new RangeError("Too many files for a standard ZIP export.");let r=t.textEncoder(),a=function(e){let t=e instanceof Date&&!Number.isNaN(e.getTime())?e:new Date,r=Math.max(1980,Math.min(2107,t.getFullYear()));return y({time:(31&t.getHours())<<11|(63&t.getMinutes())<<5|31&Math.floor(t.getSeconds()/2),date:r-1980<<9|(t.getMonth()+1&15)<<5|31&t.getDate()})}(t.now()),n=[],i=[],o=0;for(let t of e){let e=String(t&&t.name||""),s=t&&t.blob;if(!e||e.startsWith("/")||e.includes("\\")||e.split("/").some(e=>!e||"."===e||".."===e))throw new TypeError("ZIP export path is invalid.");if(!s||"number"!=typeof s.size||"function"!=typeof s.arrayBuffer)throw new TypeError("ZIP export file is invalid.");if(s.size>h)throw new RangeError("A file is too large for the lightweight ZIP32 exporter.");let l=r.encode(e);if(l.length>65535)throw new RangeError("ZIP filename is too long.");let c=await k(s),u=g(l,c,s.size,a),p=o+u.byteLength+s.size;if(p>h)throw new RangeError("Export package is too large for the lightweight ZIP32 exporter.");n.push(u,s),i.push(b(l,c,s.size,o,a)),o=p}let s=o,l=i.reduce((e,t)=>e+t.byteLength,0);if(s+l+22>h)throw new RangeError("Export package is too large for the lightweight ZIP32 exporter.");return n.push(...i,function(e,t,r){let a=new Uint8Array(22),n=new DataView(a.buffer);return w(n,0,101010256),m(n,4,0),m(n,6,0),m(n,8,e),m(n,10,e),w(n,12,t),w(n,16,r),m(n,20,0),a}(e.length,l,s)),t.makeBlob(n,"application/zip")}(P.files,{textEncoder:()=>new TextEncoder,now:()=>new Date(P.date),makeBlob:(e,t)=>new Blob(e,{type:t})});if("equalFiles"===S){let e=P.left.size;if(e!==P.right.size)return!1;for(let t=0;t<e;t+=x){let[r,a]=await Promise.all([P.left.slice(t,t+x).arrayBuffer(),P.right.slice(t,t+x).arrayBuffer()]);if(!B(r,a))return!1;O({loaded:Math.min(t+x,e),total:e,phase:"verifying"})}return!0}throw new Error("Unknown portable processing operation.")}})}(function(e,t="",r={}){if(!e){let e=function(e){return String(e??"").replace(/\r\n?/g,"\n")}(t).trimEnd();return e?M(e)+"\n":""}let a=(e.content||[]).map(e=>j(e,r)).join("").replace(/\n{3,}/g,"\n\n").trimEnd();return a?a+"\n":""});self.onmessage=async e=>{let{id:t,type:r,data:a}=e.data||{},n=0,i=e=>{let r=performance.now();(r-n>=100||e.loaded===e.total)&&(n=r,self.postMessage({id:t,progress:e}))};try{self.postMessage({id:t,value:await z.run(r,a,i)})}catch(e){self.postMessage({id:t,error:{code:e?.code,name:e instanceof Error?e.name:"Error",message:e instanceof Error?e.message:"Export processing failed."}})}}})();

/* Study Director bounded integrity worker companion. Generated from portable sources. */
(()=>{
// Incremental SHA-256: fixed block state; callers never buffer the complete file.
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
// Int32 words and inlined rotations keep the rounds in V8's integer fast
// path (about five times faster than the array-destructuring form). The
// result is the standard SHA-256 digest.
const K32=new Int32Array(K);
class Sha256 {
  constructor(){this.state=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);this.block=new Uint8Array(64);this.words=new Int32Array(64);this.length=0;this.used=0;this.finished=false;}
  compress(bytes,offset=0){
    const w=this.words,s=this.state;
    for(let i=0;i<16;i++){const j=offset+(i<<2);w[i]=(bytes[j]<<24)|(bytes[j+1]<<16)|(bytes[j+2]<<8)|bytes[j+3];}
    for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=((((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10))+w[i-7]+(((x>>>7)|(x<<25))^((x>>>18)|(x<<14))^(x>>>3))+w[i-16])|0;}
    let a=s[0]|0,b=s[1]|0,c=s[2]|0,d=s[3]|0,e=s[4]|0,f=s[5]|0,g=s[6]|0,h=s[7]|0;
    for(let i=0;i<64;i++){
      const t1=(h+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+((e&f)^(~e&g))+K32[i]+w[i])|0;
      const t2=((((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))+((a&b)^(a&c)^(b&c)))|0;
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    s[0]+=a;s[1]+=b;s[2]+=c;s[3]+=d;s[4]+=e;s[5]+=f;s[6]+=g;s[7]+=h;
  }
  update(bytes){if(this.finished)throw new Error('Hash already finished.');this.length+=bytes.length;let offset=0;if(this.used){const n=Math.min(64-this.used,bytes.length);this.block.set(bytes.subarray(0,n),this.used);this.used+=n;offset=n;if(this.used===64){this.compress(this.block);this.used=0;}}for(;offset+64<=bytes.length;offset+=64)this.compress(bytes,offset);if(offset<bytes.length){this.block.set(bytes.subarray(offset),0);this.used=bytes.length-offset;}return this;}
  hex(){if(this.finished)throw new Error('Hash already finished.');this.finished=true;const b=this.block;b[this.used++]=128;if(this.used>56){b.fill(0,this.used);this.compress(b);this.used=0;}b.fill(0,this.used,56);const view=new DataView(b.buffer);view.setUint32(56,Math.floor(this.length/0x20000000));view.setUint32(60,(this.length*8)>>>0);this.compress(b);return Array.from(this.state,v=>v.toString(16).padStart(8,'0')).join('');}
}
// Files up to NATIVE_DIGEST_MAX_BYTES are hashed by the browser's native
// SHA-256 in one call; larger ones stream through the incremental hash so the
// whole file is never held in memory. Both give the same digest.
const NATIVE_DIGEST_MAX_BYTES=32*1048576,hex=buffer=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
async function hashBlob(blob,progress=()=>{}){
  if(blob.size<=NATIVE_DIGEST_MAX_BYTES&&globalThis.crypto?.subtle){const digest=hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));progress({loaded:blob.size,total:blob.size,phase:'verifying'});return digest;}
  const hash=new Sha256();for(let offset=0;offset<blob.size;offset+=1048576){hash.update(new Uint8Array(await blob.slice(offset,offset+1048576).arrayBuffer()));progress({loaded:Math.min(offset+1048576,blob.size),total:blob.size,phase:'verifying'});}return hash.hex();
}

// A bounded writer shared by worker encryption, copying and downloads.
const OPFS_DIRECTORY='@@SD_BACKUP_FILES_OPFS_DIRECTORY@@';
const OPFS_NAME=/^backup-[a-f0-9-]{36}$/u;
async function resolveHandle(output){
  if(output?.kind!=='opfs')return output;
  const name=String(output.name||'');
  if(!OPFS_NAME.test(name))throw new Error('Backup scratch-file identity is invalid.');
  const storage=globalThis.navigator?.storage;
  if(!storage||typeof storage.getDirectory!=='function')throw new Error('Browser file storage is unavailable to the file worker.');
  const root=await storage.getDirectory(),directory=await root.getDirectoryHandle(OPFS_DIRECTORY,{create:true});
  return directory.getFileHandle(name,{create:true});
}
async function openOutput(output){
  const handle=await resolveHandle(output);
  if(!handle||typeof handle.getFile!=='function'||(typeof handle.createSyncAccessHandle!=='function'&&typeof handle.createWritable!=='function'))throw new Error('Backup file output is unavailable.');
  let sync=null,asyncWriter=null,position=0,closed=false;
  if(typeof handle.createSyncAccessHandle==='function')sync=await handle.createSyncAccessHandle();
  else asyncWriter=await handle.createWritable({keepExistingData:false});
  if(sync)sync.truncate(0);
  return {
    async write(bytes){
      if(closed)throw new Error('File output is closed.');
      if(sync){let offset=0;while(offset<bytes.byteLength){const count=sync.write(bytes.subarray(offset),{at:position});if(count<=0)throw new Error('File output made no progress.');offset+=count;position+=count;}}
      else{await asyncWriter.write(bytes);position+=bytes.byteLength;}
    },
    async close(){if(closed)return;closed=true;if(sync){try{sync.flush();}finally{sync.close();}}else await asyncWriter.close();},
    async abort(){if(closed)return;closed=true;if(sync){try{sync.truncate(0);}finally{sync.close();}}else await asyncWriter.abort();},
    file:()=>handle.getFile(),
    get size(){return position;}
  };
}
async function copyFile(file,writer,progress=()=>{}){
  for(let offset=0;offset<file.size;offset+=1048576){const bytes=new Uint8Array(await file.slice(offset,offset+1048576).arrayBuffer());await writer.write(bytes);progress({loaded:Math.min(offset+bytes.length,file.size),total:file.size,phase:'copying'});}
}

// SDENC02: fixed-size authenticated frames; output is an OPFS file, never an
// array of accumulated ciphertext/plaintext chunks. Used in the export worker.
const FRAME_BYTES=1024*1024;
const HEADER_BYTES=64;
const FRAME_WINDOW=4;
const ITERATIONS=600000,TAG_BYTES=16,MAX_CHUNKS=0xfffffffe;
const MAGIC=new TextEncoder().encode('SDENC02\n');
const VERIFIER_MAGIC=new TextEncoder().encode('SDKEY01\n'),VERIFIER_BYTES=64;
const VERIFIER_PROOF=new TextEncoder().encode('Study Director backup protection verifier v2');
const invalid=(message,code='BACKUP_ENCRYPTION_INVALID')=>Object.assign(new Error(message),{code});
const u64=(bytes,offset,value)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setBigUint64(offset,BigInt(value));
function encryptedSize(size){
  if(!Number.isSafeInteger(size)||size<1||Math.ceil(size/FRAME_BYTES)>MAX_CHUNKS)throw invalid('Backup exceeds the authenticated format’s numeric or nonce range.');
  return HEADER_BYTES+size+(Math.ceil(size/FRAME_BYTES)+1)*TAG_BYTES;
}
async function streamEncryptionInfo(file){
  if(!(file instanceof Blob))throw invalid('A backup file is required.');
  const header=new Uint8Array(await file.slice(0,HEADER_BYTES).arrayBuffer());
  if(!MAGIC.every((byte,i)=>header[i]===byte))return null;
  if(header.length!==HEADER_BYTES)throw invalid('Encrypted backup header is truncated.');
  const view=new DataView(header.buffer),size=Number(view.getBigUint64(40));
  if(header[8]!==2||header[9]!==1||header[10]!==0||header[11]!==0||view.getUint32(12)!==FRAME_BYTES||view.getUint32(16)!==ITERATIONS||header.slice(48).some(Boolean))throw invalid('Encrypted backup parameters are unsupported.');
  if(encryptedSize(size)!==file.size)throw invalid('Encrypted backup is truncated or has trailing data.');
  return {header,size,version:2};
}
async function passwordKey(password){
  if(typeof password!=='string'||!password.length||password.length>1024)throw invalid('Enter a password of 1–1024 characters.');
  const bytes=new TextEncoder().encode(password);
  try{return await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);}finally{bytes.fill(0);}
}
async function verifierHmacKey(key,salt){
  if(key?.type!=='secret'||key.algorithm?.name!=='PBKDF2'||key.extractable)throw invalid('Unlock backup protection first.','BACKUP_LOCKED');
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},key,{name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify']);
}
async function createPasswordVerifier(key){
  const header=new Uint8Array(32);header.set(VERIFIER_MAGIC);header[8]=1;header[9]=1;
  new DataView(header.buffer).setUint32(12,ITERATIONS);header.set(crypto.getRandomValues(new Uint8Array(16)),16);
  const hmac=await verifierHmacKey(key,header.slice(16,32));
  const signature=new Uint8Array(await crypto.subtle.sign('HMAC',hmac,VERIFIER_PROOF));
  return new Blob([header,signature],{type:'application/octet-stream'});
}
async function verifyPasswordVerifier(file,key){
  if(!(file instanceof Blob)||file.size!==VERIFIER_BYTES)throw invalid('Backup encryption settings are unreadable.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!VERIFIER_MAGIC.every((byte,i)=>bytes[i]===byte)||bytes[8]!==1||bytes[9]!==1||bytes[10]!==0||bytes[11]!==0||new DataView(bytes.buffer).getUint32(12)!==ITERATIONS)throw invalid('Backup encryption settings are unreadable.');
  const hmac=await verifierHmacKey(key,bytes.slice(16,32));
  if(!await crypto.subtle.verify('HMAC',hmac,bytes.slice(32),VERIFIER_PROOF))throw invalid('The password is incorrect.','BACKUP_AUTH_FAILED');
  return true;
}
async function derive(key,header){
  if(key?.type!=='secret'||key.algorithm?.name!=='PBKDF2'||key.extractable)throw invalid('Unlock backup protection first.','BACKUP_LOCKED');
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:header.slice(20,36),iterations:ITERATIONS},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function params(header,index,length,terminal){
  const iv=new Uint8Array(12);iv.set(header.slice(36,40));u64(iv,4,index);
  const aad=new Uint8Array(HEADER_BYTES+13);aad.set(header);u64(aad,HEADER_BYTES,index);new DataView(aad.buffer).setUint32(HEADER_BYTES+8,length);aad[HEADER_BYTES+12]=terminal?1:0;
  return {name:'AES-GCM',iv,additionalData:aad,tagLength:128};
}
async function transformEncrypted(file,key,writer,{decrypt=false,progress=()=>{},check=()=>{}}={}){
  let header,size=file.size;
  if(decrypt){const info=await streamEncryptionInfo(file);if(!info)throw invalid('Not a streaming encrypted backup.');({header,size}=info);}
  else{
    encryptedSize(size);header=new Uint8Array(HEADER_BYTES);header.set(MAGIC);header[8]=2;header[9]=1;
    const view=new DataView(header.buffer);view.setUint32(12,FRAME_BYTES);view.setUint32(16,ITERATIONS);
    header.set(crypto.getRandomValues(new Uint8Array(16)),20);header.set(crypto.getRandomValues(new Uint8Array(4)),36);u64(header,40,size);
  }
  const aes=await derive(key,header);check();if(!decrypt)await writer.write(header);
  // Up to FRAME_WINDOW frames are read and sealed (or opened) at once, so the
  // browser's AES runs alongside the reads; results are written strictly in
  // order and every buffer is zeroed after use. The last frame is empty and
  // marks the end.
  // Only the last data frame can be short, so frame i starts after min(i·FRAME, size)
  // plaintext bytes (plus one tag per earlier frame when decrypting).
  const frames=Math.ceil(size/FRAME_BYTES)+1,frameLength=index=>Math.max(0,Math.min(FRAME_BYTES,size-index*FRAME_BYTES)),frameStart=index=>(decrypt?HEADER_BYTES+index*TAG_BYTES:0)+Math.min(index*FRAME_BYTES,size);
  const transform=async index=>{
    const length=frameLength(index),start=frameStart(index),bytes=new Uint8Array(await file.slice(start,start+length+(decrypt?TAG_BYTES:0)).arrayBuffer());
    try{return new Uint8Array(await crypto.subtle[decrypt?'decrypt':'encrypt'](params(header,index,length,index===frames-1),aes,bytes));}
    catch(error){if(decrypt&&error.name==='OperationError')throw invalid('The password is incorrect or the encrypted backup is damaged.','BACKUP_AUTH_FAILED');throw error;}
    finally{bytes.fill(0);}
  };
  const pending=[];let launched=0,done=0;
  try{
    for(let index=0;index<frames;index++){
      check();while(pending.length<FRAME_WINDOW&&launched<frames){const task=transform(launched++);task.catch(()=>{});pending.push(task);}
      const result=await pending.shift();
      try{check();await writer.write(result);}finally{result.fill(0);}
      done+=frameLength(index);progress({loaded:done,total:size,phase:decrypt?'decrypting':'encrypting'});
    }
  }finally{for(const row of await Promise.allSettled(pending))row.value?.fill(0);}
  if(decrypt&&HEADER_BYTES+size+frames*TAG_BYTES!==file.size)throw invalid('Encrypted backup has trailing data.');
  return decrypt?size:encryptedSize(size);
}


function hashSnapshot(hash){if(hash.finished)throw new Error('Hash already finished.');return {version:1,length:hash.length,state:Array.from(hash.state),tail:Array.from(hash.block.slice(0,hash.used))};}
function restoreHash(value){
  if(!value||value.version!==1||!Number.isSafeInteger(value.length)||value.length<0||!Array.isArray(value.state)||value.state.length!==8||value.state.some(v=>!Number.isInteger(v)||v<0||v>0xffffffff)||!Array.isArray(value.tail)||value.tail.length!==value.length%64||value.tail.some(v=>!Number.isInteger(v)||v<0||v>255))throw new Error('Integrity hash checkpoint is invalid.');
  const hash=new Sha256();hash.state.set(value.state);hash.length=value.length;hash.used=value.tail.length;hash.block.set(value.tail);return hash;
}


// A checkpoint writer preserves its committed prefix on failure. Full export
// writers retain their separate truncate/abort behavior.
async function openIntegrityOutput(output,offset){
  const handle=await resolveHandle(output);
  if(!handle||!Number.isSafeInteger(offset)||offset<0||offset>(await handle.getFile()).size)throw new Error('Integrity scratch checkpoint is incomplete.');
  let sync=null,writer=null,position=offset,closed=false;
  try{
    if(typeof handle.createSyncAccessHandle==='function'){sync=await handle.createSyncAccessHandle();sync.truncate(offset);}
    else{writer=await handle.createWritable({keepExistingData:offset>0});await writer.truncate(offset);await writer.seek(offset);}
  }catch(error){
    if(sync){try{sync.close();}catch{}}
    else if(writer){try{await writer.abort();}catch{}}
    throw error;
  }
  return {
    async write(bytes){if(closed)throw new Error('Integrity output is closed.');if(sync){for(let index=0;index<bytes.byteLength;){const written=sync.write(bytes.subarray(index),{at:position});if(written<=0)throw new Error('Integrity output made no progress.');index+=written;position+=written;}}else{await writer.write(bytes);position+=bytes.byteLength;}},
    async close(){if(closed)return;closed=true;if(sync){try{sync.flush();}finally{sync.close();}}else{try{await writer.close();}catch(error){try{await writer.abort();}catch{}throw error;}}},
    async abort(){if(closed)return;closed=true;if(sync){try{sync.truncate(offset);}finally{sync.close();}}else await writer.abort();}
  };
}





// Each request performs one bounded read/hash/write or authenticated frame.
// The host commits checkpoints only after the scratch writer has flushed.
const derived=new WeakMap();
async function integritySegment(type,data){
  if(type==='integrity.digest')return restoreHash(data.hash).hex();
  if(type==='integrity.append'){
    const hash=data.hash?restoreHash(data.hash):new Sha256(),offset=hash.length;
    if(!(data.chunk instanceof Blob)||data.chunk.size<1||data.chunk.size>FRAME_BYTES||offset!==data.offset)throw new Error('Integrity segment is invalid.');
    const bytes=new Uint8Array(await data.chunk.arrayBuffer()),writer=await openIntegrityOutput(data.output,offset);
    try{await writer.write(bytes);hash.update(bytes);await writer.close();return {hash:hashSnapshot(hash),offset:hash.length,checksum:restoreHash(hashSnapshot(hash)).hex()};}
    catch(error){await writer.abort().catch(()=>{});throw error;}finally{bytes.fill(0);}
  }
  if(type==='integrity.decrypt'){
    const info=await streamEncryptionInfo(data.file);if(!info)throw new Error('The repository protection format does not match its manifest.');
    const {header,size}=info,index=Number(data.frame)||0,hash=data.hash?restoreHash(data.hash):new Sha256();
    if(!Number.isSafeInteger(index)||index<0||hash.length!==Math.min(index*FRAME_BYTES,size)||index>Math.ceil(size/FRAME_BYTES))throw new Error('Integrity frame checkpoint is invalid.');
    const identity=Array.from(header).join(','),cached=derived.get(data.key),aes=cached?.identity===identity?cached.aes:await derive(data.key,header);derived.set(data.key,{identity,aes});
    const length=Math.min(FRAME_BYTES,size-hash.length),terminal=length===0,offset=HEADER_BYTES+Math.min(index*FRAME_BYTES,size)+index*16,bytes=new Uint8Array(await data.file.slice(offset,offset+length+16).arrayBuffer());let plain,writer;
    try{
      try{plain=new Uint8Array(await crypto.subtle.decrypt(params(header,index,length,terminal),aes,bytes));}
      catch(error){if(error.name==='OperationError')throw Object.assign(new Error('Unlock the password used for this backup, or use another backup version.'),{code:'BACKUP_AUTH_FAILED'});throw error;}
      if(data.output){writer=await openIntegrityOutput(data.output,hash.length);await writer.write(plain);await writer.close();}
      hash.update(plain);return {hash:hashSnapshot(hash),offset:hash.length,frame:index+1,complete:terminal,size,checksum:terminal?restoreHash(hashSnapshot(hash)).hex():''};
    }catch(error){await writer?.abort().catch(()=>{});throw error;}finally{bytes.fill(0);plain?.fill(0);}
  }
  throw new Error('Unknown integrity segment operation.');
}

const previous=self.onmessage;self.onmessage=async event=>{const {id,type,data}=event.data||{};if(!["integrity.append","integrity.decrypt","integrity.digest"].includes(type))return previous(event);try{self.postMessage({id,value:await integritySegment(type,data)});}catch(error){self.postMessage({id,error:{code:error.code,name:error.name,message:error.message}});}};
})();
