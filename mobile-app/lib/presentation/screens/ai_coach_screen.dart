import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/tkd_theme.dart';

class AiCoachScreen extends StatefulWidget {
  const AiCoachScreen({super.key});

  @override
  State<AiCoachScreen> createState() => _AiCoachScreenState();
}

class _AiCoachScreenState extends State<AiCoachScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _plans = [];
  List<dynamic> _correctiveWorks = [];

  @override
  void initState() {
    super.initState();
    _loadTraining();
  }

  Future<void> _loadTraining() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        TkdApiClient.fetchAIPlans(),
        TkdApiClient.fetchCorrectiveWork(),
      ]);
      if (!mounted) return;
      setState(() {
        _plans = results[0];
        _correctiveWorks = results[1];
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _updateWork(Map<String, dynamic> work, String status) async {
    try {
      final updated = await TkdApiClient.updateCorrectiveWork(
        workId: work['id'].toString(),
        status: status,
      );
      if (!mounted) return;
      setState(() {
        _correctiveWorks = _correctiveWorks
            .map(
                (item) => (item as Map)['id'] == updated['id'] ? updated : item)
            .toList();
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }

  Map<String, dynamic> _asMap(dynamic value) =>
      Map<String, dynamic>.from(value as Map? ?? {});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi entrenamiento con IA'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            onPressed: _loading ? null : _loadTraining,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadTraining,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Card(
                      color: Colors.red.shade900,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(_error!,
                            style: const TextStyle(color: Colors.white)),
                      ),
                    ),
                  _sectionTitle('Planes semanales publicados'),
                  if (_plans.isEmpty)
                    _emptyMessage(
                        'Tu entrenador aún no ha publicado un plan semanal.')
                  else
                    ..._plans.map((rawPlan) {
                      final plan = _asMap(rawPlan);
                      final content = _asMap(plan['plan']);
                      final sessions =
                          content['sessions'] as List<dynamic>? ?? [];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                plan['objective']?.toString() ?? 'Plan semanal',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Semana ${plan['week_start'] ?? ''} · ${plan['periodization_phase'] ?? ''}',
                                style: const TextStyle(
                                    color: Colors.white60, fontSize: 12),
                              ),
                              const Divider(),
                              ...sessions.map((rawSession) {
                                final session = _asMap(rawSession);
                                final exercises =
                                    session['exercises'] as List<dynamic>? ??
                                        [];
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${session['date'] ?? ''} · ${session['title'] ?? 'Entrenamiento'}${session['optional'] == true ? ' · Opcional' : ''}',
                                        style: const TextStyle(
                                            color: TkdTheme.chongBlue,
                                            fontWeight: FontWeight.bold),
                                      ),
                                      Text(
                                        '${session['durationMinutes'] ?? 0} min · ${session['intensity'] ?? ''}',
                                        style: const TextStyle(
                                            color: Colors.white70,
                                            fontSize: 12),
                                      ),
                                      if (session['objective'] != null)
                                        Text(session['objective'].toString(),
                                            style: const TextStyle(
                                                color: Colors.white70,
                                                fontSize: 12)),
                                      ...exercises.map((rawExercise) {
                                        final exercise = _asMap(rawExercise);
                                        return Padding(
                                          padding: const EdgeInsets.only(
                                              left: 10, top: 5),
                                          child: Text(
                                            '• ${exercise['name'] ?? 'Ejercicio'}: ${exercise['instructions'] ?? ''}',
                                            style: const TextStyle(
                                                color: Colors.white60,
                                                fontSize: 11),
                                          ),
                                        );
                                      }),
                                    ],
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
                      );
                    }),
                  const SizedBox(height: 12),
                  _sectionTitle('Trabajos correctivos y adicionales'),
                  if (_correctiveWorks.isEmpty)
                    _emptyMessage('No tienes trabajos correctivos asignados.')
                  else
                    ..._correctiveWorks.map((rawWork) {
                      final work = _asMap(rawWork);
                      final status = work['status']?.toString() ?? '';
                      final exercises =
                          work['exercises'] as List<dynamic>? ?? [];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      work['title']?.toString() ??
                                          'Trabajo correctivo',
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  if (work['optional'] == true)
                                    const Chip(
                                        label: Text('Opcional'),
                                        visualDensity: VisualDensity.compact),
                                ],
                              ),
                              Text(work['objective']?.toString() ?? '',
                                  style: const TextStyle(
                                      color: Colors.white70, fontSize: 12)),
                              if (work['planned_session_date'] != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 5),
                                  child: Text(
                                      'Sesión: ${work['planned_session_date']}',
                                      style: const TextStyle(
                                          color: TkdTheme.chongBlue,
                                          fontSize: 12)),
                                ),
                              ...exercises.map((rawExercise) {
                                final exercise = _asMap(rawExercise);
                                return Padding(
                                  padding: const EdgeInsets.only(top: 7),
                                  child: Text(
                                    '• ${exercise['name'] ?? ''}: ${exercise['instructions'] ?? ''}',
                                    style: const TextStyle(
                                        color: Colors.white60, fontSize: 11),
                                  ),
                                );
                              }),
                              if (status == 'ASSIGNED' ||
                                  status == 'IN_PROGRESS')
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton.icon(
                                    onPressed: () => _updateWork(
                                      work,
                                      status == 'ASSIGNED'
                                          ? 'IN_PROGRESS'
                                          : 'COMPLETED',
                                    ),
                                    icon: Icon(status == 'ASSIGNED'
                                        ? Icons.play_arrow
                                        : Icons.check),
                                    label: Text(status == 'ASSIGNED'
                                        ? 'Empezar'
                                        : 'Completar'),
                                  ),
                                )
                              else
                                Text('Estado: $status',
                                    style: const TextStyle(
                                        color: Colors.white54, fontSize: 11)),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }

  Widget _sectionTitle(String value) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold)),
      );

  Widget _emptyMessage(String value) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Text(value,
            style: const TextStyle(color: Colors.white54, fontSize: 12)),
      );
}
