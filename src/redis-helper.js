const Redis = require("redis");
const wsLogger = require("./ws-logger");

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const REDIS_PROVIDER = process.env.HEROKU_REDIS_RED_URL || 'redis://127.0.0.1:6379'


class RedisHelper {

    static tag="RedisHelper";

    static createRedisClient(u){
        return Redis.createClient(u);
    }

    static closeRedisClient(rc){
        try{
            rc.quit();
        }catch(e){
        }
    }

    static subscribe(subscriber,pattern,onMessage) {
        if (subscriber==null){
            wsLogger.log(RedisHelper.tag,"subscriber is null","error",false);
            return;
        }
        subscriber.on("error",function(error){
            wsLogger.log(RedisHelper.tag,"subscriber error: " + error,'error',true);
            RedisHelper.closeRedisClient(this);
        });
        subscriber.on("subscribe", function (channel, count) {
            wsLogger.log(RedisHelper.tag,"subscribed to: " + channel + ",count: " + count);
        });
        subscriber.on("message", onMessage);
        subscriber.subscribe(pattern);
    }
}

module.exports.create=RedisHelper.createRedisClient;
module.exports.close=RedisHelper.closeRedisClient;
module.exports.subscribe=RedisHelper.subscribe;
module.exports.REDIS_URL=REDIS_URL;
module.exports.REDIS_PROVIDER=REDIS_PROVIDER;