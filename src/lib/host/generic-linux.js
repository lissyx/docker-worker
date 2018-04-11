/**
Return the appropriate configuration defaults when on generic linux.
*/

const got = require('got-promise');
const taskcluster = require('taskcluster-client');
const _ = require('lodash');
const { createLogger } = require('../log');

let log = createLogger({
  source: 'host/generic-linux'
});

let os = require('os');

function minutes(n) {
  return n * 60;
}

const BASE_URL = 'http://169.254.169.254/latest';

async function getText(url) {
  try {
    const res = await got(url);
    return res.body;
  }
  catch (e) {
    // Some meta-data endpoints 404 until they have a value to display (spot node termination)
    if (e.response.statusCode !== 404) throw e;
  }
}

module.exports = {
  /**
  @return Number of seconds this worker has been running.
  */
  billingCycleUptime() {
    return os.uptime();
  },

  /**
  */
  async configure(baseUrl=BASE_URL) {
    log('configure', { url: BASE_URL });

    // defaults per the metadata
    let metadata = await Promise.all([
      // host
      os.hostname(),
      // Public IP
      getText('http://whatismyip.akamai.com/'),
      // Private IP
      os.networkInterfaces()['eth0'][0].address,
      // workerId
      process.env.DS_WORKER_ID,
      // workerGroup
      process.env.DS_WORKER_GROUP,
      // workerNodeType
      process.env.DS_WORKER_NODE_TYPE
    ]);

    let config = {
      host: metadata[0],
      publicIp: metadata[1],
      privateIp: metadata[2],
      workerId: metadata[3],
      workerGroup: metadata[4],
      workerNodeType: metadata[5],
      instanceId: metadata[3],
      region: metadata[4],
      instanceType: metadata[5],
      restrictCPU: false,
      shutdown: {
        enabled: false,
        afterIdleSeconds: minutes(0),
      },
      logging: {
        secureLiveLogging: false
      },
      statelessHostname: {
        enabled: true
      },
      deviceManagement: {
        cpu: {
          enabled: true
        },
        loopbackAudio: {
          enabled: false
        },
        loopbackVideo: {
          enabled: false
        }
      }
    };

    log('metadata', config);

    let userdata = {
      'workerType': process.env.DS_WORKER_TYPE,
      'provisionerId': process.env.DS_PROVISIONER_ID,
      'capacity': process.env.DS_CAPACITY,
      'monitorProject': process.env.DS_MONITOR_PROJECT
    };

    log('read userdata', { text: userdata });

    // Log config for record of configuration but without secrets
    log('config', config);

    // Order of these matter.  We want secret data to override all else, including
    // taskcluster credentials (if perma creds are provided by secrets.data)
    return _.defaultsDeep(
      {},
      {},
      userdata.data,
      {
        capacity: userdata.capacity,
        workerType: userdata.workerType,
        provisionerId: userdata.provisionerId,
        monitorProject: userdata.monitorProject,
      },
      config
    );
  },

  async getTerminationTime() {
    /*
    var d = new Date(Date.now() + (1 * 86400 * 1000));
    log('terminationTime', { text: d.toISOString() });
    return d.toISOString();
    */
  }
};
