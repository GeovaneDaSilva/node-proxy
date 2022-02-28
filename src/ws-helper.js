const crypto = require('crypto')

const signAlgorithm = 'sha256';

const secret = process.env.SOCKET_PROXY_SECRET || 'b4a006d17ffa123605a2425071034ff56d7f74b576ed55aee0a5f807579f71933fb4d026e8f9a64ad73e4a639c485f8dbe0158dc2c6ae511808bff14a4513300'

class WsHelper {

  static tag = "WsHelper";

  static md5(str) {
    return crypto.createHash("md5").update(str).digest("hex");
  }

  static verifyToken(signed_token) {
    let [data, signature] = signed_token.split("--", 2)

    let hmac = crypto.createHmac(signAlgorithm, secret)

    hmac.update(data)

    let digest = hmac.digest('hex')

    if (digest == signature) {
      let decrypt = JSON.parse((Buffer.from(data, 'base64')).toString('utf8'))
      let json_license_key = (Buffer.from(decrypt._rails.message, 'base64')).toString('utf8')
      return JSON.parse(json_license_key).license_key
    } else {
      return false
    }
  }

  static validateUrl(url) {
    let vals = url.split("/");

    if (vals.length < 3) {
      return false;
    }

    let signed_token = vals[vals.length - 2].trim();

    let fingerprint = vals[vals.length - 1].trim();

    return [signed_token, fingerprint];
  }

  static unixTimestamp(dt) {
    return (!dt) ? new Date().getTime() / 1000 : dt.getTime() / 1000;
  }

  static getHexString(len) {
    const hex = "0123456789ABCDEF";
    return [...Array(len).keys()].map(x => hex.charAt(Math.floor(Math.random() * hex.length))).join('');
  }
}

function createWsHelper() {
  return new WsHelper();
}

module.exports.createWsHelper = createWsHelper;
module.exports.verifyToken = WsHelper.verifyToken;
module.exports.unixTimestamp = WsHelper.unixTimestamp;
module.exports.getHexString = WsHelper.getHexString;
module.exports.validateUrl = WsHelper.validateUrl;
module.exports.md5 = WsHelper.md5;