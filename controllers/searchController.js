const Patient = require('../models/Patient');
const User = require('../models/User');

const SEARCH_LIMIT = 6;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchCondition(fields, query) {
  const terms = String(query || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => new RegExp(escapeRegex(term), 'i'));

  if (terms.length === 0) {
    return null;
  }

  return {
    $and: terms.map((term) => ({
      $or: fields.map((field) => ({ [field]: term }))
    }))
  };
}

async function searchDirectory(req, res) {
  const query = String(req.query.q || '').trim();

  if (query.length < 2) {
    return res.status(200).json({
      success: true,
      query,
      patients: [],
      staff: []
    });
  }

  const patientCondition = buildSearchCondition(
    ['patientId', 'firstName', 'lastName', 'email', 'phone'],
    query
  );
  const staffCondition = buildSearchCondition(['fullName', 'email', 'role'], query);

  try {
    const [patients, staff] = await Promise.all([
      Patient.find(patientCondition)
        .sort({ firstName: 1, lastName: 1 })
        .limit(SEARCH_LIMIT)
        .select('patientId firstName lastName phone email'),
      User.find({
        role: { $ne: 'patient' },
        ...staffCondition
      })
        .sort({ fullName: 1, email: 1 })
        .limit(SEARCH_LIMIT)
        .select('fullName email role')
    ]);

    return res.status(200).json({
      success: true,
      query,
      patients,
      staff
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not complete the search.'
    });
  }
}

module.exports = {
  searchDirectory
};
