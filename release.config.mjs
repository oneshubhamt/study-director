const release='SDVB75F22';
const sourceDateEpoch='2026-10-27T00:00:00.000Z';
const buildDate=sourceDateEpoch.slice(0,10).replaceAll('-','');
const buildId=`${release.toLowerCase()}-${buildDate}-r1`;

// Increment `release` by one in each pull request that changes the shipped app
// (source, portable or rich-text); see AGENTS.md. Derived identities must not
// duplicate the release number independently.
export const deploymentDirectoryName=`StudyDirector-${release}-Deployment`;

export default Object.freeze({
  release,
  buildId,
  sourceDateEpoch,
  googleOAuth: Object.freeze({
    productionClientId: '306494096916-p48tjuv0ni01c11a0dp4ini9gp3dafdi.apps.googleusercontent.com',
    developmentClientId: ''
  })
});
