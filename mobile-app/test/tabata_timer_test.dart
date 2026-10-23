import 'package:flutter_test/flutter_test.dart';
import 'package:tkd_mobile_app/services/tabata_timer.dart';

void main() {
  group('TabataTimer', () {
    test('runs the standard 20/10 intervals for eight rounds', () {
      final timer = TabataTimer(preparationSeconds: 0);
      timer.start();

      for (var round = 1; round <= 8; round++) {
        expect(timer.phase, TabataPhase.work);
        expect(timer.currentRound, round);
        for (var second = 0; second < 20; second++) {
          timer.tick();
        }

        expect(timer.phase, TabataPhase.rest);
        for (var second = 0; second < 10; second++) {
          timer.tick();
        }
      }

      expect(timer.phase, TabataPhase.completed);
      expect(timer.elapsedSeconds, 240);
      expect(timer.isRunning, isFalse);
    });

    test('supports preparation, pause, resume, skipping, and reset', () {
      final timer = TabataTimer(
        preparationSeconds: 3,
        workSeconds: 2,
        restSeconds: 1,
        totalRounds: 2,
      );

      timer.start();
      expect(timer.phase, TabataPhase.preparation);
      timer.tick();
      timer.pause();
      timer.tick();
      expect(timer.secondsRemaining, 2);
      expect(timer.elapsedSeconds, 1);

      timer.resume();
      timer.skipPhase();
      expect(timer.phase, TabataPhase.work);
      timer.skipPhase();
      expect(timer.phase, TabataPhase.rest);
      timer.tick();
      expect(timer.phase, TabataPhase.work);
      expect(timer.currentRound, 2);
      timer.skipPhase();
      expect(timer.phase, TabataPhase.rest);
      timer.skipPhase();
      expect(timer.phase, TabataPhase.completed);

      timer.reset();
      expect(timer.phase, TabataPhase.ready);
      expect(timer.currentRound, 0);
      expect(timer.secondsRemaining, 3);
      expect(timer.elapsedSeconds, 0);
    });
  });
}
