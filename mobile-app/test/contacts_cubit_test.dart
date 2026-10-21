import 'package:flutter_test/flutter_test.dart';
import 'package:safedrive/presentation/contacts/contacts_cubit.dart';
import 'package:safedrive/services/storage/contacts_repository.dart';

void main() {
  late InMemoryContactsRepository repo;
  late ContactsCubit cubit;

  setUp(() {
    repo = InMemoryContactsRepository();
    cubit = ContactsCubit(repo);
  });

  tearDown(() async {
    await cubit.close();
    repo.dispose();
  });

  test('adds contacts with increasing priority and normalised phone', () async {
    expect(await cubit.add('Mom', '010 1234 5678'), isNull);
    expect(await cubit.add('Ahmed', '+201112223334'), isNull);
    expect(repo.current.map((c) => c.priority), [1, 2]);
    expect(repo.current.first.phone, '01012345678');
  });

  test('rejects bad input and duplicates', () async {
    expect(await cubit.add('', '01012345678'), 'Enter a name');
    expect(await cubit.add('X', '12'), 'Enter a valid phone number');
    await cubit.add('Mom', '01012345678');
    expect(await cubit.add('Dad', '010-1234-5678'), 'This number is already added');
  });

  test('allows at most 5 contacts', () async {
    for (var i = 0; i < 5; i++) {
      expect(await cubit.add('C$i', '0100000000$i'), isNull);
    }
    expect(cubit.isFull, isTrue);
    expect(await cubit.add('Six', '01000000009'), contains('up to 5'));
  });

  test('remove and reorder keep priorities 1..n', () async {
    await cubit.add('A', '01000000001');
    await cubit.add('B', '01000000002');
    await cubit.add('C', '01000000003');

    await cubit.reorder(2, 0); // C to the top
    expect(repo.current.map((c) => c.name), ['C', 'A', 'B']);
    expect(repo.current.map((c) => c.priority), [1, 2, 3]);

    await cubit.remove(repo.current[1].id); // remove A
    expect(repo.current.map((c) => c.name), ['C', 'B']);
    expect(repo.current.map((c) => c.priority), [1, 2]);
  });
}
