const WsHelper=require("./ws-helper")
const RedisHelper=require("./redis-helper")
const WsLogger=require("./ws-logger");
const MessageQueuer=require("./message-queuer")

class MessageHandler {

    static tag="MessageHandler"

    constructor(data, socket, fingerprint,sideKiqPool) {
        this.data = data
        this.socket = socket
        this.fingerprint = fingerprint
        this.sideKiqPool=sideKiqPool
        this.redisPool = RedisHelper.create(RedisHelper.REDIS_URL);
        this.redisPool.on("error", function (error) {
            WsLogger.log(MessageHandler.tag,"redisPool error: " + error,"error",true)
            RedisHelper.close(this)
        });
    }
  
    handle() {
        let message_type = this.data["type"]
        
        if (message_type == "ack") {
            //redispool lrange
            //loop through each message in lrange
            //if payload matches md5 digest of message
            //remove it from the queue using lrem

            WsLogger.log(MessageHandler.tag, `message ${message_type} received from Device ${this.fingerprint}`)

            let queue = "queue.device." + this.fingerprint
            this.redisPool.lrange(
                queue,
                0,
                -1,
                function (err, reply) {
                    if (err) {
                        WsLogger.log(MessageHandler.tag,"lrange error: " + err,"error",true)
                        RedisHelper.close(this.redisPool)
                        return
                    }
                    for (let b = 0; b < reply.length; b++) {
                        let queued_message = reply[b]
                        let digest = WsHelper.md5(queued_message);
                        console.log(`#########################: ACK_${queued_message}`)
                        if (digest == this.data["payload"]) {
                            this.redisPool.lrem(
                                "queue.device." + this.fingerprint,
                                0,
                                queued_message
                            )
                        }
                    }
                    RedisHelper.close(this.redisPool)
                }.bind(this)
            );
        } else if (message_type == "ready") {
            this.redisPool.publish("trigger.queue.device", this.fingerprint);
            MessageQueuer.create(this.fingerprint,this.data,message_type,this.sideKiqPool).enqueue()
            RedisHelper.close(this.redisPool)
        } else {
            MessageQueuer.create(this.fingerprint,this.data,message_type,this.sideKiqPool).enqueue()
            RedisHelper.close(this.redisPool)
        }
    }
}

function createMessageHandler(data, socket, fingerprint,sideKiqPool){
    return new MessageHandler(data,socket,fingerprint,sideKiqPool)
}

module.exports.create=createMessageHandler