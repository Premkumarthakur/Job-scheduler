function parseExpression(expression) {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 6) {
    throw new Error('Cron expression must have 6 fields: second minute hour day month dayOfWeek');
  }

  return {
    second: parts[0],
    minute: parts[1],
    hour: parts[2],
    day: parts[3],
    month: parts[4],
    dayOfWeek: parts[5]
  };
}

function getNextRunTime(cronExpression, fromDate = new Date()) {
  try {
    const expr = parseExpression(cronExpression);
    const date = new Date(fromDate);

    date.setMilliseconds(0);

    for (let i = 0; i < 366 * 24 * 60 * 60; i++) {
      date.setSeconds(date.getSeconds() + 1);

      if (matchesExpression(date, expr)) {
        return date;
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing cron expression:', error);
    return null;
  }
}

function matchesExpression(date, expr) {
  return (
    matchesField(date.getSeconds(), expr.second, 0, 59) &&
    matchesField(date.getMinutes(), expr.minute, 0, 59) &&
    matchesField(date.getHours(), expr.hour, 0, 23) &&
    matchesField(date.getDate(), expr.day, 1, 31) &&
    matchesField(date.getMonth() + 1, expr.month, 1, 12) &&
    matchesField(date.getDay(), expr.dayOfWeek, 0, 6)
  );
}

function matchesField(value, pattern, min, max) {
  if (pattern === '*') {
    return true;
  }

  if (pattern.includes('/')) {
    const [range, step] = pattern.split('/');
    const stepNum = parseInt(step);

    if (range === '*') {
      return (value - min) % stepNum === 0;
    }
  }

  if (pattern.includes('-')) {
    const [start, end] = pattern.split('-').map(Number);
    return value >= start && value <= end;
  }

  if (pattern.includes(',')) {
    const values = pattern.split(',').map(Number);
    return values.includes(value);
  }

  return value === parseInt(pattern);
}

function validateCronExpression(expression) {
  try {
    parseExpression(expression);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  getNextRunTime,
  validateCronExpression,
  parseExpression
};
