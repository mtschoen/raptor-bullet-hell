import type { Vec2 } from '../game/types';

export function circlesOverlap(
  firstCenterX: number,
  firstCenterY: number,
  firstRadius: number,
  secondCenterX: number,
  secondCenterY: number,
  secondRadius: number,
): boolean {
  const differenceX = secondCenterX - firstCenterX;
  const differenceY = secondCenterY - firstCenterY;
  const combinedRadius = firstRadius + secondRadius;
  return differenceX * differenceX + differenceY * differenceY < combinedRadius * combinedRadius;
}

export function pointInCircle(
  pointX: number,
  pointY: number,
  circleCenterX: number,
  circleCenterY: number,
  circleRadius: number,
): boolean {
  const differenceX = pointX - circleCenterX;
  const differenceY = pointY - circleCenterY;
  return differenceX * differenceX + differenceY * differenceY <= circleRadius * circleRadius;
}

export function circlesOverlapPoints(
  firstCenter: Vec2,
  firstRadius: number,
  secondCenter: Vec2,
  secondRadius: number,
): boolean {
  return circlesOverlap(
    firstCenter.x,
    firstCenter.y,
    firstRadius,
    secondCenter.x,
    secondCenter.y,
    secondRadius,
  );
}

export function pointInCirclePoint(point: Vec2, circleCenter: Vec2, circleRadius: number): boolean {
  return pointInCircle(point.x, point.y, circleCenter.x, circleCenter.y, circleRadius);
}

export function distanceBetween(firstPoint: Vec2, secondPoint: Vec2): number {
  const differenceX = secondPoint.x - firstPoint.x;
  const differenceY = secondPoint.y - firstPoint.y;
  return Math.sqrt(differenceX * differenceX + differenceY * differenceY);
}
