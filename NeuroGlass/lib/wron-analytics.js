// Wron analytics: custom events only. No events are sent before opt-in.
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_ID = "e406596d0c97d82ecac44675";
const CONFIG = {};
const PREFIX = 'wron.analytics.' + APP_ID + '.';
let consent;
let anonymousId;
let userId;

function newId() {
  return 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 14);
}

async function getConsent() {
  if (consent === undefined) consent = (await AsyncStorage.getItem(PREFIX + 'consent')) === 'yes';
  return consent;
}

async function distinctId() {
  if (userId === undefined) userId = await AsyncStorage.getItem(PREFIX + 'user');
  if (userId) return userId;
  if (!anonymousId) {
    anonymousId = await AsyncStorage.getItem(PREFIX + 'anonymous');
    if (!anonymousId) {
      anonymousId = newId();
      await AsyncStorage.setItem(PREFIX + 'anonymous', anonymousId);
    }
  }
  return anonymousId;
}

// Call only after someone explicitly opts in. Turning it off stops future events.
export async function setAnalyticsConsent(allowed) {
  consent = allowed === true;
  await AsyncStorage.setItem(PREFIX + 'consent', consent ? 'yes' : 'no');
  if (!consent) await resetAnalyticsIdentity();
}

// Use your app's stable account ID after sign-in; never an email address.
export async function setAnalyticsUserId(id) {
  if (!await getConsent()) return false;
  if (typeof id !== 'string' || !id.trim() || id.length > 128) return false;
  userId = id.trim();
  await AsyncStorage.setItem(PREFIX + 'user', userId);
  return true;
}

// Call on sign-out so the next person on this device gets a new anonymous ID.
export async function resetAnalyticsIdentity() {
  userId = null;
  anonymousId = newId();
  await AsyncStorage.multiSet([[PREFIX + 'user', ''], [PREFIX + 'anonymous', anonymousId]]);
}

export async function trackEvent(name, properties) {
  if (!await getConsent()) return { sent: false, reason: 'no_consent' };
  if (typeof name !== 'string' || !/^[A-Za-z0-9 _.-]{1,100}$/.test(name)) throw new Error('Invalid analytics event name');
  if (properties != null && (typeof properties !== 'object' || Array.isArray(properties))) throw new Error('Invalid analytics properties');
  const values = properties || {};
  if (JSON.stringify(values).length > 8192) throw new Error('Analytics properties are too large');
  const safe = Object.fromEntries(Object.entries(values).filter(function (entry) {
    return !['token', 'distinct_id', '$insert_id', 'wron_app_id', 'ip'].includes(entry[0]);
  }));
  const id = await distinctId();
  const eventId = newId();
  const jobs = [];
  if (CONFIG.posthog) {
    const host = CONFIG.posthog.region === 'eu' ? 'https://eu.i.posthog.com' : 'https://us.i.posthog.com';
    jobs.push(fetch(host + '/i/v0/e/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: CONFIG.posthog.token, event: name, properties: Object.assign({}, safe, {
        distinct_id: id, wron_app_id: APP_ID, '$insert_id': eventId, '$process_person_profile': Boolean(userId),
      }) }) }).then(function (res) { if (!res.ok) throw new Error('PostHog rejected event'); }));
  }
  if (CONFIG.mixpanel) {
    const host = CONFIG.mixpanel.region === 'eu' ? 'https://api-eu.mixpanel.com' :
      CONFIG.mixpanel.region === 'in' ? 'https://api-in.mixpanel.com' : 'https://api.mixpanel.com';
    jobs.push(fetch(host + '/track?verbose=1&ip=0', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ event: name, properties: Object.assign({}, safe, {
        token: CONFIG.mixpanel.token, distinct_id: id, wron_app_id: APP_ID, '$insert_id': eventId,
      }) }]) }).then(async function (res) {
        if (!res.ok || (await res.json()).status !== 1) throw new Error('Mixpanel rejected event');
      }));
  }
  const results = await Promise.allSettled(jobs);
  return { sent: results.some(function (result) { return result.status === 'fulfilled'; }),
    failed: results.filter(function (result) { return result.status === 'rejected'; }).length };
}
