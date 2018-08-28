"use strict";

const log = require('loglevel'),
  _ = require('lodash');

require('loglevel-prefix-persist/server')(process.env.NODE_ENV, log, {
  level: {
    production: 'debug',
    development: 'debug'
  },
  persist: 'debug',
  max: 5
});

log.setLevel('debug');

let totalRaidsConverted = 0;

const storage = require('node-persist'),
  activeRaids = storage.create({
    dir: 'raids/active',
    forgiveParseErrors: true
  }),
  completeRaids = storage.create({
    dir: 'raids/complete',
    forgiveParseErrors: true
  }),
  activeParties = storage.create({
    dir: 'parties/active',
    forgiveParseErrors: true
  }),
  completeParties = storage.create({
    dir: 'parties/complete',
    forgiveParseErrors: true
  }),

  migrateRaid = function (raid) {
    const party = _.mapKeys(raid, ((value, key) => {
      return _.camelCase(key);
    }));

    const pokemon = _.mapKeys(party.pokemon, ((value, key) => {
      return _.camelCase(key);
    }));

    if (!!pokemon.stats) {
      pokemon.bossCP = pokemon.bossCp;
      pokemon.maxBaseCP = pokemon.maxBaseCp;
      pokemon.maxBoostedCP = pokemon.maxBoostedCp;
      pokemon.minBaseCP = pokemon.minBaseCp;
      pokemon.minBoostedCP = pokemon.minBoostedCp;

      delete pokemon.bossCp;
      delete pokemon.maxBaseCp;
      delete pokemon.maxBoostedCp;
      delete pokemon.minBaseCp;
      delete pokemon.minBoostedCp;
    }

    party.type = 'raid';
    party.pokemon = pokemon;

    return party;
  },
  migrateRaids = async function () {
    await activeRaids.init();
    await completeRaids.init();

    await activeParties.init();
    await completeParties.init();

    await activeRaids
      .forEach(async ({key, value}) => {
        const channelId = key,
          raid = value,
          party = migrateRaid(raid);

        totalRaidsConverted++;

        log.debug(`Converting active raid for gym ${raid.gym_id}...`);

        await activeParties.setItem(channelId, party);
      });

    await completeRaids.forEach(async ({key, value}) => {
      const gymId = key,
        raids = value,
        parties = raids
          .map(raid => migrateRaid(raid));

      totalRaidsConverted += raids.length;

      log.debug(
        `Converting ${raids.length} complete raids for gym ${gymId}...`);

      await completeParties.setItem(gymId, parties);
    });

    log.info(`Done...${totalRaidsConverted} raids converted!`);
    process.exit(0);
  };

migrateRaids()
  .catch(log.error);
