const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../../src/routes');

function routes() {
  return router.stack
    .filter(layer => layer.route)
    .map(layer => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      handlers: layer.route.stack.map(handler => handler.name)
    }));
}

function findRoute(path, method) {
  return routes().find(route => route.path === path && route.methods.includes(method));
}

test('user-facing browsing routes require authentication', () => {
  [
    ['/events', 'get'],
    ['/events/:id', 'get'],
    ['/venues', 'get'],
    ['/venues/:id', 'get'],
    ['/seat-types', 'get'],
    ['/showtimes', 'get'],
    ['/showtimes/event/:eventId', 'get'],
    ['/showtimes/:id', 'get'],
    ['/showtimes/:id/booked-seats', 'get']
  ].forEach(([path, method]) => {
    const route = findRoute(path, method);
    assert.ok(route, `${method.toUpperCase()} ${path} route should exist`);
    assert.equal(route.handlers[0], 'authenticateToken');
  });
});

test('staff backend scope excludes bookings, transactions, and dashboard routes', () => {
  assert.equal(findRoute('/staff/bookings', 'get'), undefined);
  assert.equal(findRoute('/staff/transactions', 'get'), undefined);
  assert.equal(findRoute('/staff/dashboard', 'get'), undefined);
});

test('generic event creation route is closed in favor of admin/staff event routes', () => {
  assert.equal(findRoute('/events', 'post'), undefined);
});

test('seat lock helper routes require authentication', () => {
  [
    ['/seats/lock', 'post'],
    ['/seats/unlock', 'post']
  ].forEach(([path, method]) => {
    const route = findRoute(path, method);
    assert.ok(route, `${method.toUpperCase()} ${path} route should exist`);
    assert.equal(route.handlers[0], 'authenticateToken');
  });
});
