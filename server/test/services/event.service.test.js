const test = require('node:test');
const assert = require('node:assert/strict');
const { createEventService } = require('../../src/services/event.service');

function serviceWith(overrides = {}) {
  return createEventService({
    roles: {
      findByName: async () => ({ RoleID: 3 })
    },
    events: {
      create: async (payload) => payload,
      ...overrides.events
    }
  });
}

test('createEvent rejects missing category', async () => {
  const service = serviceWith();

  await assert.rejects(
    () => service.createEvent({
      user: { userId: 1, role: 1 },
      title: 'Test Event',
      description: '',
      categoryId: ''
    }),
    { statusCode: 400, message: 'Category is required' }
  );
});

test('createEvent trims title and sends required category id', async () => {
  const service = serviceWith();

  const result = await service.createEvent({
    user: { userId: 1, role: 1 },
    title: '  Test Event  ',
    description: 'Description',
    categoryId: '2'
  });

  assert.deepEqual(result, {
    title: 'Test Event',
    description: 'Description',
    categoryId: 2
  });
});
