function createMockResponse() {
  const res = {
    statusCode: 200,
    body: undefined,
    sent: undefined,
    filePath: undefined,
    redirectPath: undefined,
    clearedCookies: []
  };

  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };

  res.json = function json(payload) {
    this.body = payload;
    return this;
  };

  res.send = function send(payload) {
    this.sent = payload;
    return this;
  };

  res.sendFile = function sendFile(filePath) {
    this.filePath = filePath;
    return this;
  };

  res.redirect = function redirect(path) {
    this.redirectPath = path;
    return this;
  };

  res.clearCookie = function clearCookie(name) {
    this.clearedCookies.push(name);
    return this;
  };

  return res;
}

function createMockRequest({
  body = {},
  query = {},
  params = {},
  session = {},
  sessionUser,
  appGet = () => undefined
} = {}) {
  const req = {
    body,
    query,
    params,
    session: { ...session },
    app: {
      get: appGet
    }
  };

  if (sessionUser) {
    req.session.user = sessionUser;
  }

  return req;
}

function stub(implementation = () => undefined) {
  function fn(...args) {
    fn.calls.push(args);
    return implementation(...args);
  }

  fn.calls = [];
  return fn;
}

function createQueryChain(result) {
  const chain = {
    calls: [],
    sort(arg) {
      this.calls.push(['sort', arg]);
      return this;
    },
    select(arg) {
      this.calls.push(['select', arg]);
      return this;
    },
    populate(...args) {
      this.calls.push(['populate', ...args]);
      return this;
    },
    limit(arg) {
      this.calls.push(['limit', arg]);
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(result).catch(reject);
    }
  };

  return chain;
}

function objectIdLike(value) {
  return {
    toString() {
      return value;
    }
  };
}

module.exports = {
  createMockRequest,
  createMockResponse,
  createQueryChain,
  objectIdLike,
  stub
};
