import React, { useState } from "react";
import { FlatList, Image, Linking, Text, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useApp } from "../services/Provider";
import { RootStack, useNav } from "../navigation/types";
import { styles as s } from "../theme";
import {
  Badge,
  Button,
  Chips,
  Empty,
  ErrorText,
  Field,
  Loading,
  Notice,
  Screen,
  useAction,
  useAsync,
} from "../components/ui";
import { SearchableSelect } from "../components/SearchableSelect";
import { DoctorCard, DoctorAvatar } from "../components/cards";
import { KeyboardList } from "../components/KeyboardLayout";

export function DoctorsScreen() {
  const { services } = useApp();
  const nav = useNav();
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [locality, setLocality] = useState("");
  const { data, loading, error } = useAsync(
    () => services.doctor.list(query, specialty, locality),
    [services, query, specialty, locality],
  );
  return (
    <KeyboardList
      showsVerticalScrollIndicator={false}
      style={s.page}
      contentContainerStyle={s.content}
      data={data ?? []}
      keyExtractor={(d) => d.id}
      renderItem={({ item }) => (
        <DoctorCard
          doctor={item}
          onPress={() => nav.navigate("Doctor", { id: item.id })}
        />
      )}
      ListHeaderComponent={
        <View style={s.section}>
          <Badge text="CARE IN YOUR NEIGHBOURHOOD" />
          <Text style={s.title}>Find your doctor</Text>
          <Text style={s.text}>The right care, a little closer.</Text>
          <Field
            label="Search doctors"
            placeholder="Doctor, clinic or specialty"
            value={query}
            onChangeText={setQuery}
          />

          <SearchableSelect
            label="Specialty" values={services.reference.specialties}
            selected={specialty}
            onSelect={setSpecialty}
            emptyLabel="All specialties"
          />

          <SearchableSelect
            label="Locality" values={services.reference.doctorLocalities}
            selected={locality}
            onSelect={setLocality}
            emptyLabel="All localities"
          />
          <Text style={s.small}>
            {data?.length ?? 0} doctors · Hyderabad hospital directory
          </Text>
          <ErrorText error={error} />
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <Loading />
        ) : (
          <Empty
            title="No doctors found"
            detail="Try another specialty, locality or search term."
          />
        )
      }
    />
  );
}
export function DoctorScreen() {
  const { services } = useApp();
  const route = useRoute<RouteProp<RootStack, "Doctor">>();
  const action = useAction();
  const {
    data: doctor,
    error,
    loading,
  } = useAsync(
    () => services.doctor.get(route.params.id),
    [services, route.params.id],
  );
  if (loading) return <Loading />;
  if (!doctor)
    return (
      <Screen>
        <ErrorText error={error} />
      </Screen>
    );
  return (
    <Screen>
      <View style={[s.card, s.centered]}>
        <DoctorAvatar doctor={doctor} large />
        <Badge text="Hospital-listed doctor" />
        <Text style={s.title}>{doctor.name}</Text>
        <Text style={s.text}>{doctor.qualifications}</Text>
        <Badge text={doctor.specialty} />
      </View>
      <Text style={s.heading}>Clinic information</Text>
      {doctor.clinics.map(clinic => <View key={clinic.id} style={s.card}>
        <Text style={s.heading}>{clinic.name}</Text>
        <Text style={s.text}>{clinic.address}</Text>
        <Button title="Get Directions" icon="navigate-outline" onPress={() => action.run(async () => { await Linking.openURL(clinic.directionsUrl); })} />
        <Text style={s.heading}>Consultation timings</Text>
        <Text style={s.text}>{clinic.timings}</Text>
        <Text style={s.small}>Published hospital schedule. Confirm before visiting.</Text>
      </View>)}
      {doctor.contact && /^\+?[0-9]{10,13}$/.test(doctor.contact) ? (
        <Button
          title={`Call ${doctor.contact}`}
          icon="call-outline"
          onPress={() =>
            action.run(async () => {
              await Linking.openURL(`tel:${doctor.contact}`);
            })
          }
        />
      ) : null}
      <Button title="View hospital profile" icon="open-outline" onPress={() => action.run(async () => { await Linking.openURL(doctor.sourceUrl); })} />
      <ErrorText error={action.error} />
      <Text style={s.small}>
        Source: Yashoda Hospitals · Checked 20 September 2026. Contact and appointment options are available on the hospital profile. This directory does not show live appointments.
      </Text>
    </Screen>
  );
}
