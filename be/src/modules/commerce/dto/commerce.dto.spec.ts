import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePlanDto, UpdateScheduleDto, ReviewDto } from './commerce.dto';
import { WorkoutDto } from '../../workout-plans/dto/workout.dto';
describe('API payload boundaries', () => {
  it.each([
    ['price', null],
    ['groupSessionQuota', -1],
    ['durationDays', 1.5],
  ])('rejects invalid partial plan field %s', async (key, value) => {
    expect(
      (await validate(plainToInstance(UpdatePlanDto, { [key]: value }))).length,
    ).toBeGreaterThan(0);
  });
  it('allows omitted fields while rejecting null schedule capacity', async () => {
    expect(await validate(plainToInstance(UpdateScheduleDto, {}))).toHaveLength(
      0,
    );
    expect(
      (await validate(plainToInstance(UpdateScheduleDto, { capacity: null })))
        .length,
    ).toBeGreaterThan(0);
  });
  it('rejects malformed nested workout exercise data', async () => {
    const dto = plainToInstance(WorkoutDto, {
      memberId: '00000000-0000-4000-8000-000000000001',
      title: 'Workout',
      exercises: [
        {
          exerciseId: '00000000-0000-4000-8000-000000000002',
          sets: 0,
          reps: -1,
        },
      ],
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
  it('rejects string booleans in review decisions', async () => {
    expect(
      (await validate(plainToInstance(ReviewDto, { approve: 'false' }))).length,
    ).toBeGreaterThan(0);
  });
});
