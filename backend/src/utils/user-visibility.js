export function canSeeRatingsForRole(role) {
  return role === 'ADM';
}

export function canRequesterSeeRatings(requestUser) {
  return canSeeRatingsForRole(requestUser?.role);
}

export function sanitizeUserPayloadForRole(userPayload, role) {
  if (!userPayload || canSeeRatingsForRole(role)) {
    return userPayload;
  }

  const next = { ...userPayload };
  delete next.ratingAverage;
  delete next.initialRating;
  return next;
}
