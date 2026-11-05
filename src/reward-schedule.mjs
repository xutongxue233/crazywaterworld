// A new game connection always verifies the server again. Stopping and starting
// idle on the same connection keeps its confirmed cooldowns.
const schedules = new WeakMap();
const day = 86400;
const beijing = 8 * 3600;

export function rewardSchedule(client) {
  if (schedules.has(client)) return schedules.get(client);
  const deadlines = new Map();
  const observations = new Map();
  const expected = new Map();
  const now = () => Math.floor((Date.now() + (client.serverClockOffsetMs || 0)) / 1000);
  function clearTask(key) {
    for (const saved of deadlines.keys()) {
      if (saved === key || saved.startsWith(key + ':')) deadlines.delete(saved);
    }
  }
  const schedule = {
    now,
    observe(key, text, state='waiting') { observations.set(key,{text,state,checkedAt:now()}); },
    expect(key, until) { if(Number.isFinite(until))expected.set(key,Math.ceil(until)); },
    status: key => observations.get(key) ?? null,
    nextCheck: key => deadlines.get(key) > now() ? deadlines.get(key) : expected.get(key)>now()?expected.get(key):null,
    nextDay: () => (Math.floor((now() + beijing) / day) + 1) * day - beijing,
    due(key) {
      if (deadlines.get(key) > now()) return false;
      deadlines.delete(key);
      return true;
    },
    defer(key, until) {
      if (Number.isFinite(until) && until > now()) { deadlines.set(key, Math.ceil(until)); if (!observations.has(key)) observations.set(key,{text:"已检查，等待下次开放",checkedAt:now()}); }
    },
    clear: key => deadlines.delete(key),
    clearTask,
  };
  client.on?.('message', ({ name, body }) => {
    switch (name) {
      case 'SCServerTimeChanged':
      case 'SCDailyTaskReset':
        deadlines.clear(); observations.clear(); expected.clear();
        break;
      case 'SCDailyTaskUpdate':
        if (!body?.task || body.task.rewardClaimed || body.task.progress >= body.task.targetProgress) {
          clearTask('dailyRewards');
          clearTask('chests');
        }
        break;
      case 'SCDailyWeeklyReset':
        clearTask('chests');
        clearTask('weekGift');
        break;
      case 'SCNewEmail': clearTask('mail'); break;
      case 'SCJoinGuild':
      case 'SCLeaveGuild':
      case 'SCNewGuildWelfarePack': clearTask('guildWelfare'); break;
      case 'SCOrderOfTheDay': clearTask('orderDaily'); break;
      case 'SCAllActivity':
        clearTask('weekGift');
        clearTask('weekTimes');
        clearTask('weekPass');
        clearTask('newbieLogin');
        break;
      case 'SCNewbieActivityUpdate': clearTask('newbieLogin'); break;
      case 'SCTrialRaidUpdate':
        schedule.clear('trialSweep');
        if (body?.raid?.raidId) schedule.clear('trialSweep:' + body.raid.raidId);
        break;
      case 'SCVipUpdate':
        clearTask('pirate');
      case 'SCActivityPaidMoneyUpdate':
        clearTask('adShop');
        break;
    }
  });
  schedules.set(client, schedule);
  return schedule;
}
