/* eslint-disable prefer-destructuring */
const ADMIN_USERNAME = process.env.NEXT_PUBLIC_ADMIN_USERNAME;
const ADMIN_STREAMKEY = process.env.NEXT_PUBLIC_ADMIN_STREAMKEY;
export const NEXT_PUBLIC_API_HOST = process.env.NEXT_PUBLIC_API_HOST;

const API_LOCATION = `${NEXT_PUBLIC_API_HOST}api/admin/`;

export const FETCH_INTERVAL = 15000;

// Current inbound broadcaster info
export const STATUS = `${API_LOCATION}status`;

// Disconnect inbound stream
export const DISCONNECT = `${API_LOCATION}disconnect`;

// Change the current streaming key in memory
export const STREAMKEY_CHANGE = `${API_LOCATION}changekey`;

// Current server config
export const SERVER_CONFIG = `${API_LOCATION}serverconfig`;

// Base url to update config settings
export const SERVER_CONFIG_UPDATE_URL = `${API_LOCATION}config`;

// Get viewer count over time
export const VIEWERS_OVER_TIME = `${API_LOCATION}viewersOverTime`;

// Get active viewer details
export const ACTIVE_VIEWER_DETAILS = `${API_LOCATION}viewers`;

// Get currently connected chat clients
export const CONNECTED_CLIENTS = `${API_LOCATION}chat/clients`;

// Get list of disabled/blocked chat users
export const DISABLED_USERS = `${API_LOCATION}chat/users/disabled`;

// Disable/enable a single user
export const USER_ENABLED_TOGGLE = `${API_LOCATION}chat/users/setenabled`;

// Get banned IP addresses
export const BANNED_IPS = `${API_LOCATION}chat/users/ipbans`;

// Remove IP ban
export const BANNED_IP_REMOVE = `${API_LOCATION}chat/users/ipbans/remove`;

// Disable/enable a single user
export const USER_SET_MODERATOR = `${API_LOCATION}chat/users/setmoderator`;

// Get list of moderators
export const MODERATORS = `${API_LOCATION}chat/users/moderators`;

// Get hardware stats
export const HARDWARE_STATS = `${API_LOCATION}hardwarestats`;

// Get all logs
export const LOGS_ALL = `${API_LOCATION}logs`;

// Get warnings + errors
export const LOGS_WARN = `${API_LOCATION}logs/warnings`;

// Get chat history
export const CHAT_HISTORY = `${API_LOCATION}chat/messages`;

// Get chat history
export const UPDATE_CHAT_MESSGAE_VIZ = `/api/admin/chat/messagevisibility`;

// Upload a new custom emoji
export const UPLOAD_EMOJI = `${API_LOCATION}emoji/upload`;

// Delete a custom emoji
export const DELETE_EMOJI = `${API_LOCATION}emoji/delete`;

// Get all access tokens
export const ACCESS_TOKENS = `${API_LOCATION}accesstokens`;

// Delete a single access token
export const DELETE_ACCESS_TOKEN = `${API_LOCATION}accesstokens/delete`;

// Create a new access token
export const CREATE_ACCESS_TOKEN = `${API_LOCATION}accesstokens/create`;

// Get webhooks
export const WEBHOOKS = `${API_LOCATION}webhooks`;

// Delete a single webhook
export const DELETE_WEBHOOK = `${API_LOCATION}webhooks/delete`;

// Create a single webhook
export const CREATE_WEBHOOK = `${API_LOCATION}webhooks/create`;

// hard coded social icons list
export const SOCIAL_PLATFORMS_LIST = `${NEXT_PUBLIC_API_HOST}api/socialplatforms`;

// set external action links
export const EXTERNAL_ACTIONS = `${API_LOCATION}api/externalactions`;

// send a message to the fediverse
export const FEDERATION_MESSAGE_SEND = `${API_LOCATION}federation/send`;

// Get followers
export const FOLLOWERS = `${API_LOCATION}followers`;

// Get followers pending approval
export const FOLLOWERS_PENDING = `${API_LOCATION}followers/pending`;

// Get followers who were blocked or rejected
export const FOLLOWERS_BLOCKED = `${API_LOCATION}followers/blocked`;

// Approve, reject a follow request
export const SET_FOLLOWER_APPROVAL = `${API_LOCATION}followers/approve`;

// List of inbound federated actions that took place.
export const FEDERATION_ACTIONS = `${API_LOCATION}federation/actions`;

export const API_STREAM_HEALTH_METRICS = `${API_LOCATION}metrics/video`;

// Save an array of stream keys
export const UPDATE_STREAM_KEYS = `${API_LOCATION}config/streamkeys`;

export const API_YP_RESET = `${API_LOCATION}yp/reset`;

export const TEMP_UPDATER_API = LOGS_ALL;

const GITHUB_RELEASE_URL = 'https://api.github.com/repos/owncast/owncast/releases/latest';

interface FetchOptions {
  data?: any;
  method?: string;
  auth?: boolean;
}

export async function fetchData(url: string, options?: FetchOptions) {
  const { data, method = 'GET', auth = true } = options || {};

  // eslint-disable-next-line no-undef
  const requestOptions: RequestInit = {
    method,
  };

  if (data) {
    requestOptions.body = JSON.stringify(data);
  }

  if (auth && ADMIN_USERNAME && ADMIN_STREAMKEY) {
    const encoded = btoa(`${ADMIN_USERNAME}:${ADMIN_STREAMKEY}`);
    requestOptions.headers = {
      Authorization: `Basic ${encoded}`,
    };
    requestOptions.mode = 'cors';
    requestOptions.credentials = 'include';
  }

  const response = await fetch(url, requestOptions);
  const json = await response.json();

  if (!response.ok) {
    const message = json.message || `An error has occurred: ${response.status}`;
    throw new Error(message);
  }
  return json;
}

export async function getUnauthedData(url: string, options?: FetchOptions) {
  const opts = {
    method: 'GET',
    auth: false,
    ...options,
  };
  return fetchData(url, opts);
}

export async function fetchExternalData(url: string) {
  try {
    const response = await fetch(url, {
      referrerPolicy: 'no-referrer', // Send no referrer header for privacy reasons.
      referrer: '',
    });
    if (!response.ok) {
      const message = `An error has occured: ${response.status}`;
      throw new Error(message);
    }
    const json = await response.json();
    return json;
  } catch (error) {
    console.log(error);
  }
  return {};
}

export async function getGithubRelease() {
  return fetchExternalData(GITHUB_RELEASE_URL);
}

// Stolen from https://gist.github.com/prenagha/98bbb03e27163bc2f5e4
const VPAT = /^\d+(\.\d+){0,2}$/;
function upToDate(local, remote) {
  if (!local || !remote || local.length === 0 || remote.length === 0) return false;
  if (local === remote) return true;
  if (VPAT.test(local) && VPAT.test(remote)) {
    const lparts = local.split('.');
    while (lparts.length < 3) lparts.push('0');
    const rparts = remote.split('.');
    while (rparts.length < 3) rparts.push('0');
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < 3; i++) {
      const l = parseInt(lparts[i], 10);
      const r = parseInt(rparts[i], 10);
      if (l === r)
        // eslint-disable-next-line no-continue
        continue;
      return l > r;
    }
    return true;
  }
  return local >= remote;
}

// Make a request to the server status API and the Github releases API
// and return a release if it's newer than the server version.
export async function upgradeVersionAvailable(currentVersion) {
  const recentRelease = await getGithubRelease();
  let recentReleaseVersion = recentRelease.tag_name;

  if (recentReleaseVersion.substr(0, 1) === 'v') {
    recentReleaseVersion = recentReleaseVersion.substr(1);
  }

  if (!upToDate(currentVersion, recentReleaseVersion)) {
    return recentReleaseVersion;
  }

  return null;
}
