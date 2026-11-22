import type {Candidate} from '../backup.ts';
import type {BackupFile} from '../backup-models.ts';
import type {StudyDirectorPublicApi} from '../public-api-host.ts';

async function exerciseBackupPublicApi(api:StudyDirectorPublicApi,file:BackupFile,candidate:Candidate){
  await api.backup.createCheckpoint(
    {interactive:false},
    {
      stage(message:string){void message;},
      progress(value:{loaded?:number;total?:number}){void value;}
    }
  );
  const inspected:Candidate=await api.backup.inspect(file,{filename:'typed.sdbackup',interactive:false});
  await inspected.release();
  await api.backup.restore(candidate,{missingOnly:true,confirmed:true});
  await api.backup.downloadSafetyCopy({includeAssetBlobs:true,assumeFlushed:true});
}
void exerciseBackupPublicApi;
