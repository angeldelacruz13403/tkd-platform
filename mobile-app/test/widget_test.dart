// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:tkd_mobile_app/main.dart';

void main() {
  testWidgets('mobile app opens athlete sign in when no session exists', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const TkdMobileApp());
    await tester.pumpAndSettle();
    expect(find.text('TKD GLOBAL'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsOneWidget);
  });
}
