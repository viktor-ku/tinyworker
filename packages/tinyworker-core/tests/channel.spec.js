import { it, expect } from "vitest";
import { Channel } from "../src/channel.js";

it("should be able to init and retrieve the value", ({ onTestFinished }) => {
  const num = new Channel(0);
  expect(num.value(), "initial value reflected").toBe(0);

  onTestFinished(() => {
    num.close();
  });
});

it("should be able to send new value", ({ onTestFinished }) => {
  const num = new Channel(0);

  num.tx(42);
  expect(num.value(), "new value reflected immediately").toBe(42);

  onTestFinished(() => {
    num.close();
  });
});

it("should be able to send & receive", ({ onTestFinished }) => {
  const num = new Channel(0);

  onTestFinished(() => {
    num.close();
  });

  return new Promise((resolve) => {
    num.recv(({ next }) => {
      expect(next).toBe(42);
      resolve();
    });

    num.tx(42);
  });
});

it("should be able to ack the message stopping further recv", ({
  onTestFinished,
}) => {
  const num = new Channel(0);

  onTestFinished(() => {
    num.close();
  });

  const arr = [];

  num.recv(({ next, ack }) => {
    if (next > 5) {
      ack();
    } else {
      arr.push(next);
    }
  });

  for (let i = 1; i <= 10; i += 1) {
    num.tx(i);
  }

  expect(arr).toEqual([1, 2, 3, 4, 5]);
  expect(num.value()).toEqual(10);
});
