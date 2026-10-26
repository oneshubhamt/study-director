import {Heading,Decoration,GardState} from '../../rich-text/wordgard-adapter';
import type {AssetStore,MountOptions,RichTextApi,MountedRichTextEditor} from '../../rich-text/editor';
import type {AttachmentRequest,SearchRequest,ImageRequest,ImageReply,WorkerReply} from '../../portable/worker-contracts';
import type {WG1Envelope} from '../../rich-text/wg1-codec';
// Detect unresolved upstream imports even when declaration emission uses noCheck.
type IsAny<T>=0 extends (1&T)?true:false;
const headingIsAny:false=null as unknown as IsAny<typeof Heading>;
const schemaIsAny:false=null as unknown as IsAny<GardState['schema']>;
const decorationIsAny:false=null as unknown as IsAny<typeof Decoration.Point.source>;
void [headingIsAny,schemaIsAny,decorationIsAny];
Heading.of(1);
// @ts-expect-error -- the upstream heading parameter is numeric, not any.
Heading.of('heading');
declare const store:AssetStore;
// @ts-expect-error -- attachment storage writes binary data, not text.
void store.put('asset','text');
declare const editor:MountedRichTextEditor;
// @ts-expect-error -- search direction is constrained to adjacent results.
editor.stepSearch(5);
declare const options:MountOptions;
// @ts-expect-error -- no unknown editor surfaces.
options.surface='other';
declare const api:RichTextApi;
// @ts-expect-error -- invalid attachment insertion mode cannot be expressed.
api.insertAttachmentReference('',{id:'asset',mode:'file'});
const query:SearchRequest={type:'query',id:1,query:'text'};
// @ts-expect-error -- query messages cannot substitute a document for the query.
const wrongQuery:SearchRequest={type:'query',id:1,document:{key:'note'}};
const ingest:AttachmentRequest<Blob>={id:1,type:'ingest',data:{directory:'attachments',file:new Blob(),storageName:'blob'}};
// @ts-expect-error -- a verify request needs the read-back identity and size.
const wrongVerify:AttachmentRequest<Blob>={id:1,type:'verify',data:{directory:'attachments',storageName:'blob'}};
const image:ImageRequest<Blob>={file:new Blob(),mimeType:'image/png'};
// @ts-expect-error -- image responses retain numeric dimensions.
const wrongImage:ImageReply<Blob>={result:{blob:new Blob(),width:'10',height:10}};
// @ts-expect-error -- progress has required numeric byte counts.
const wrongProgress:WorkerReply<boolean>={id:1,progress:{phase:'copying',loaded:1}};
// @ts-expect-error -- only the current WG1 envelope version exists.
const old:WG1Envelope={version:0,doc:{type:'Doc'}};
void [query,wrongQuery,ingest,wrongVerify,image,wrongImage,wrongProgress,old];
