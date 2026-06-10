import 'package:evolvesprouts_app/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('App renders the placeholder home screen', (tester) async {
    await tester.pumpWidget(const App());

    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.text('Evolve Sprouts App'), findsOneWidget);
  });
}
