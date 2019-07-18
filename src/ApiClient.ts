import Axios from "axios";
import { AxiosRequestConfig, AxiosPromise, Method } from "axios";
import hmacSHA256 from "crypto-js/hmac-sha256";
import base64 from "crypto-js/enc-base64";

export interface IHttpResponse {
  statusCode: number;
  statusReason: string;
  contentType: string | null;
  body: any;
  charset: string | null;
}

export class HttpError extends Error {
  message: string;
  reponse: IHttpResponse;

  constructor(response: IHttpResponse) {
    super(response.statusReason);
    this.message = response.statusReason;
    this.reponse = response;
  }
}

class QueryString {
  static parse(str: string): any {
    str = str.trim().replace(/^(\?|#)/, "");
    if (!str) {
      return null;
    }

    const data = str
      .trim()
      .split("&")
      .reduce((ret: any, param) => {
        var parts = param.replace(/\+/g, " ").split("=");
        var key = parts[0];
        var val: string | null = parts[1];

        key = decodeURIComponent(key);
        val = val === undefined ? null : decodeURIComponent(val);
        if (!ret.hasOwnProperty(key)) {
          ret[key] = val;
        } else if (Array.isArray(ret[key])) {
          ret[key].push(val);
        } else {
          ret[key] = [ret[key], val];
        }

        return ret;
      }, {});

    return data;
  }

  static stringify(data: any): string {
    return data
      ? Object.keys(data)
          .map(key => {
            var val = data[key];

            if (Array.isArray(val)) {
              return val
                .map(
                  val2 =>
                    encodeURIComponent(key) + "=" + encodeURIComponent(val2)
                )
                .join("&");
            }

            return encodeURIComponent(key) + "=" + encodeURIComponent(val);
          })
          .join("&")
      : "";
  }
}

export class ApiClient {
  constructor(
    private url: string,
    private apiKey: string,
    private sharedSecret: string
  ) {
    if (this.url[url.length - 1] !== "/") {
      this.url += "/";
    }
    this.url += "api/cqs/";
  }

  async command(message: any) {
    await this.request("POST", message, null);
  }

  async query(query: any): Promise<any> {
    return await this.request("GET", null, query);
  }

  private createSignature(sharedSecret: string, message: string): string {
    var hash = hmacSHA256(message, sharedSecret);
    var hashInBase64 = base64.stringify(hash);
    return hashInBase64;
  }

  private async request(
    method: Method,
    message: any,
    queryParameters: any
  ): Promise<any> {
    var json = JSON.stringify(message);
    var signature = this.createSignature(this.sharedSecret, json);

    var config: AxiosRequestConfig = {
      url: this.url,
      method: method,
      data: json,
      headers: {
        Accept: "application/json",
        Authorization: `ApiKey ${this.apiKey} ${signature}`,
        "X-Api-Signature": signature,
        "X-Api-Key": this.apiKey,
        "X-Cqs-Name": message.constructor.TYPE_NAME
      }
    };
    if (queryParameters != null) {
      config.url += "?" + QueryString.stringify(queryParameters);
    }

    var result = await Axios.request(config);

    // no data
    if (result.status == 204) {
      return null;
    }

    if (result.status >= 400) {
      throw new HttpError({
        body: result.data,
        charset: result.headers.charset,
        contentType: result.request.contentType,
        statusCode: result.status,
        statusReason: result.statusText
      });
    }

    return result.data;
  }
}
