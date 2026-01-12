// meta (id + kind) | payload
// [Uint8Array      , payload]

const C_PING = 0b0001;
const C_COM = 0b0010;
const C_ERR = 0b0100;

export const getKind = (it) => it[0][0];

export const isPing = (it) => getKind(it) === C_PING;
export const isCom = (it) => getKind(it) === C_COM;
export const isErr = (it) => getKind(it) === C_ERR;

export function Ping() {
  return [createMeta(C_PING)];
}

export function Com(payload, id) {
  let meta;

  if (id) {
    meta = id.slice();
  } else {
    meta = createMeta(C_COM);
  }

  return [meta, payload];
}

export function Err(err) {
  return [createMeta(C_ERR), err instanceof Error ? err.toString() : err];
}

export function payload(it) {
  return it[1];
}

export function sameId(a, b) {
  const aId = id(a);
  const bId = id(b);

  if (aId === bId) {
    return true;
  }

  for (let i = 1, len = 64; i < len; i += 1) {
    if (aId[i] !== bId[i]) {
      return false;
    }
  }

  return true;
}

export function id(it) {
  return it[0];
}

function createMeta(kind) {
  const buf = new Uint8Array(64);
  self.crypto.getRandomValues(buf);
  buf[0] = kind;
  return buf;
}
