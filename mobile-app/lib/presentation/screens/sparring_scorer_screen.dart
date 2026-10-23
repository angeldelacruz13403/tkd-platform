import 'package:flutter/material.dart';
import '../../core/theme/tkd_theme.dart';

class SparringScorerScreen extends StatefulWidget {
  const SparringScorerScreen({Key? key}) : super(key: key);

  @override
  State<SparringScorerScreen> createState() => _SparringScorerScreenState();
}

class _SparringScorerScreenState extends State<SparringScorerScreen> {
  int chongScore = 8;
  int hongScore = 6;
  int chongGamJeom = 0;
  int hongGamJeom = 1;

  void _addPoints(bool isChong, int pts) {
    setState(() {
      if (isChong) {
        chongScore += pts;
      } else {
        hongScore += pts;
      }
    });
  }

  void _addGamJeom(bool isChong) {
    setState(() {
      if (isChong) {
        chongGamJeom++;
        hongScore++; // Gam-jeom otorga 1 punto al rival
      } else {
        hongGamJeom++;
        chongScore++;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Marcador Electrónico Daedo"),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() {
                chongScore = 0;
                hongScore = 0;
                chongGamJeom = 0;
                hongGamJeom = 0;
              });
            },
          ),
        ],
      ),
      body: Row(
        children: [
          // CHONG SIDE (Blue)
          Expanded(
            child: Container(
              color: TkdTheme.chongBlue.withOpacity(0.15),
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text("CHONG (AZUL)", style: TextStyle(color: TkdTheme.chongBlue, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text("$chongScore", style: const TextStyle(fontSize: 72, fontWeight: FontWeight.w900, color: Colors.white)),
                  Text("Gam-Jeom: $chongGamJeom", style: const TextStyle(color: TkdTheme.gold, fontSize: 12)),
                  const Spacer(),
                  _buildScoreBtn("Puño (+1)", () => _addPoints(true, 1)),
                  _buildScoreBtn("Peto (+2)", () => _addPoints(true, 2)),
                  _buildScoreBtn("Cabeza (+3)", () => _addPoints(true, 3)),
                  _buildScoreBtn("Giro Cabeza (+5)", () => _addPoints(true, 5)),
                  _buildGamJeomBtn(() => _addGamJeom(true)),
                ],
              ),
            ),
          ),

          // HONG SIDE (Red)
          Expanded(
            child: Container(
              color: TkdTheme.hongRed.withOpacity(0.15),
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text("HONG (ROJO)", style: TextStyle(color: TkdTheme.hongRed, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text("$hongScore", style: const TextStyle(fontSize: 72, fontWeight: FontWeight.w900, color: Colors.white)),
                  Text("Gam-Jeom: $hongGamJeom", style: const TextStyle(color: TkdTheme.gold, fontSize: 12)),
                  const Spacer(),
                  _buildScoreBtn("Puño (+1)", () => _addPoints(false, 1)),
                  _buildScoreBtn("Peto (+2)", () => _addPoints(false, 2)),
                  _buildScoreBtn("Cabeza (+3)", () => _addPoints(false, 3)),
                  _buildScoreBtn("Giro Cabeza (+5)", () => _addPoints(false, 5)),
                  _buildGamJeomBtn(() => _addGamJeom(false)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScoreBtn(String label, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: Colors.white24),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12)),
        ),
      ),
    );
  }

  Widget _buildGamJeomBtn(VoidCallback onTap) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: TkdTheme.gold.withOpacity(0.2),
          side: const BorderSide(color: TkdTheme.gold),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: const Text("Gam-Jeom", style: TextStyle(color: TkdTheme.gold, fontSize: 12, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
