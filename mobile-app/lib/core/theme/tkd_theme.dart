import 'package:flutter/material.dart';

class TkdTheme {
  // World Taekwondo official colors
  static const Color chongBlue = Color(0xFF0EA5E9); // Blue corner
  static const Color hongRed = Color(0xFFEF4444);   // Red corner
  static const Color gold = Color(0xFFF59E0B);
  static const Color darkBg = Color(0xFF06090F);
  static const Color cardBg = Color(0xFF0F172A);
  static const Color borderSubtle = Color(0xFF1E293B);

  // Heart Rate Zone Colors
  static const Color zone1 = Color(0xFF10B981); // 50-60% Recovery
  static const Color zone2 = Color(0xFF0EA5E9); // 60-70% Aerobic
  static const Color zone3 = Color(0xFFF59E0B); // 70-80% Tempo
  static const Color zone4 = Color(0xFFF97316); // 80-90% Threshold
  static const Color zone5 = Color(0xFFEF4444); // >90% Anaerobic Power

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: darkBg,
      primaryColor: chongBlue,
      colorScheme: const ColorScheme.dark(
        primary: chongBlue,
        secondary: hongRed,
        surface: cardBg,
        background: darkBg,
      ),
      fontFamily: 'Inter',
      appBarTheme: const AppBarTheme(
        backgroundColor: darkBg,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
      cardTheme: CardThemeData(
        color: cardBg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: borderSubtle),
        ),
      ),
    );
  }
}
