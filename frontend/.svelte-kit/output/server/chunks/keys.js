function missionsCacheKey(filters, sort, page) {
  return JSON.stringify({ filters, sort, page });
}
function statisticsCacheKey(granularity) {
  return granularity;
}
export {
  missionsCacheKey as m,
  statisticsCacheKey as s
};
