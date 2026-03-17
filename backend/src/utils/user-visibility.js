export function canSeeRatingsForRole(role) {
  return role === 'ADM';
}

export function canRequesterSeeRatings(requestUser) {
  return canSeeRatingsForRole(requestUser?.role);
}

export function sanitizeUserPayloadForRole(userPayload, role, options = {}) {
  const includeOwnRatings = Boolean(options?.includeOwnRatings);

  if (!userPayload || canSeeRatingsForRole(role) || includeOwnRatings) {
    return userPayload;
  }

  const next = { ...userPayload };
  delete next.ratingAverage;
  delete next.initialRating;
  return next;
}
