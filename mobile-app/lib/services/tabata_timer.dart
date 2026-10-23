enum TabataPhase {
  ready,
  preparation,
  work,
  rest,
  completed,
}

class TabataTimer {
  TabataTimer({
    this.preparationSeconds = 5,
    this.workSeconds = 20,
    this.restSeconds = 10,
    this.totalRounds = 8,
  })  : assert(preparationSeconds >= 0),
        assert(workSeconds > 0),
        assert(restSeconds > 0),
        assert(totalRounds > 0),
        secondsRemaining = preparationSeconds;

  final int preparationSeconds;
  final int workSeconds;
  final int restSeconds;
  final int totalRounds;

  TabataPhase phase = TabataPhase.ready;
  int currentRound = 0;
  int secondsRemaining;
  int elapsedSeconds = 0;
  bool isRunning = false;

  int get currentPhaseDuration {
    switch (phase) {
      case TabataPhase.preparation:
        return preparationSeconds;
      case TabataPhase.work:
        return workSeconds;
      case TabataPhase.rest:
        return restSeconds;
      case TabataPhase.ready:
      case TabataPhase.completed:
        return 0;
    }
  }

  void start() {
    if (phase != TabataPhase.ready) return;
    currentRound = 1;
    phase = preparationSeconds > 0 ? TabataPhase.preparation : TabataPhase.work;
    secondsRemaining =
        preparationSeconds > 0 ? preparationSeconds : workSeconds;
    isRunning = true;
  }

  void resume() {
    if (phase != TabataPhase.ready && phase != TabataPhase.completed) {
      isRunning = true;
    }
  }

  void pause() {
    isRunning = false;
  }

  bool tick() {
    if (!isRunning) return false;
    elapsedSeconds++;
    if (secondsRemaining > 1) {
      secondsRemaining--;
      return false;
    }
    _advancePhase();
    return true;
  }

  bool skipPhase() {
    if (!isRunning) return false;
    _advancePhase();
    return true;
  }

  void reset() {
    phase = TabataPhase.ready;
    currentRound = 0;
    secondsRemaining = preparationSeconds;
    elapsedSeconds = 0;
    isRunning = false;
  }

  void _advancePhase() {
    switch (phase) {
      case TabataPhase.preparation:
        phase = TabataPhase.work;
        secondsRemaining = workSeconds;
        break;
      case TabataPhase.work:
        phase = TabataPhase.rest;
        secondsRemaining = restSeconds;
        break;
      case TabataPhase.rest:
        if (currentRound >= totalRounds) {
          phase = TabataPhase.completed;
          secondsRemaining = 0;
          isRunning = false;
        } else {
          currentRound++;
          phase = TabataPhase.work;
          secondsRemaining = workSeconds;
        }
        break;
      case TabataPhase.ready:
      case TabataPhase.completed:
        return;
    }
  }
}
