import { ProductPrice } from "./ProductPrice";
import React, { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Doctor, Medicine, Order } from "../services/types";
import { colors, styles as s } from "../theme";
import { Badge, dateLabel, money } from "./ui";
import { productImages } from "../data/productImages";

export function DoctorAvatar({ doctor, large = false }: { doctor: Doctor; large?: boolean }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  if (doctor.photo && /^https?:\/\//.test(doctor.photo) && !photoFailed) return <Image source={{uri: doctor.photo}} accessibilityLabel={`${doctor.name} portrait`} onError={() => setPhotoFailed(true)} style={{width:large ? 96 : 56,height:large ? 96 : 56,borderRadius:large ? 48 : 28}} />;
  const initials = doctor.name.replace(/^Dr\.\s*/, "").split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join("");
  return <View accessibilityLabel={`${doctor.name} initials`} style={[s.avatar, { backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }, large && { width: 96, height: 96, borderRadius: 48 }]}>
    <Text style={{ color: colors.primaryDark, fontWeight: "700", fontSize: large ? 32 : 22 }}>{initials}</Text>
  </View>;
}
export function MedicineArt({
  large = false,
  image,
  name = "Medicine",
}: {
  large?: boolean;
  image?: string;
  name?: string;
}) {
  const [failedImage, setFailedImage] = useState<string>();
  const source = image && (productImages[image] || (/^https?:\/\//.test(image) ? { uri: image } : undefined));
  return (
    <View style={[s.medicineIcon, { width: 90, height: 96, flexShrink: 1, backgroundColor: colors.white, padding: 6 }, large && { width: "100%", height: 220 }]}>
      {source && failedImage !== image ? (
        <Image
          source={source}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
          accessibilityLabel={`${name} pack photo`}
          onError={() => setFailedImage(image)}
        />
      ) : (
        <View style={{ width: large ? 138 : 44, height: large ? 90 : 42, backgroundColor: colors.white, borderWidth: 1, borderColor: "#CDDCE2", borderRadius: 3, transform: [{ rotate: "-8deg" }], overflow: "hidden", justifyContent: "space-between" }}>
          <View style={{ height: large ? 16 : 8, backgroundColor: colors.primary }} />
          <Ionicons name="medical" size={large ? 28 : 16} color={colors.primary} style={{ alignSelf: "center" }} />
          <View style={{ height: large ? 12 : 6, backgroundColor: "#D7EAE8" }} />
        </View>
      )}
    </View>
  );
}
export function MedicineCard({
  medicine,
  onPress,
}: {
  medicine: Medicine;
  onPress: () => void;
}) {
  return (
    <Pressable
      android_ripple={{ color: "#C9E8DF" }}
      accessibilityRole="button"
      accessibilityLabel={`View ${medicine.brandName}`}
      onPress={onPress}
      style={s.card}
    >
      <View style={s.row}>
        <MedicineArt image={medicine.image} name={medicine.brandName} />
        <View style={s.grow}>
          <Text style={s.label}>{medicine.brandName}</Text>
          <Text style={s.small}>
            {medicine.genericName} · {medicine.strength}
          </Text>
          <Text style={s.small}>{medicine.packageSize}</Text>
          <Text style={s.small}>{medicine.manufacturer}</Text>
          <ProductPrice price={medicine.price} mrp={medicine.mrp} />
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </View>
      <View style={s.between}>
        {medicine.prescriptionRequired && <Badge text="Prescription Required" warning />}
        <Text style={[s.badgeText, { color: colors.primary, marginLeft: "auto", textAlign: "right" }]}>View details</Text>
      </View>
    </Pressable>
  );
}
export function DoctorCard({
  doctor,
  onPress,
}: {
  doctor: Doctor;
  onPress: () => void;
}) {
  return (
    <Pressable
      android_ripple={{ color: "#C9E8DF" }}
      accessibilityRole="button"
      accessibilityLabel={`View ${doctor.name}`}
      onPress={onPress}
      style={s.card}
    >
      <View style={s.row}>
        <DoctorAvatar doctor={doctor} />
        <View style={s.grow}>
          <Text style={s.heading}>{doctor.name}</Text>
          <Text style={s.small}>{doctor.qualifications}</Text>
          <Text style={[s.label, { color: colors.primary }]}>
            {doctor.specialty}
          </Text>
        </View>
      </View>
      <Text style={s.text}>{doctor.clinic}</Text>
      <View style={s.between}>
        <View style={s.row}>
          <Ionicons name="location-outline" size={18} color={colors.muted} />
          <Text style={s.small}>{doctor.locality}</Text>
        </View>
        <Text style={[s.small, { color: colors.primary }]}>View profile →</Text>
      </View>
    </Pressable>
  );
}
export function OrderCard({
  order,
  onPress,
}: {
  order: Order;
  onPress: () => void;
}) {
  return (
    <Pressable
      android_ripple={{ color: "#C9E8DF" }}
      accessibilityRole="button"
      accessibilityLabel={`View order ${order.id}`}
      onPress={onPress}
      style={s.card}
    >
      <View style={s.between}>
        <Text style={[s.label, s.grow]} numberOfLines={1}>
          Order ID: {order.id}
        </Text>
        <Badge text={order.status} warning={order.status === "Cancelled"} />
      </View>
      {order.items.map(item => <View key={item.medicine.id} style={{ gap: 4 }}>
        <Text style={s.text}>{item.medicine.brandName} × {item.quantity}</Text>
        <ProductPrice price={item.medicine.price} mrp={item.medicine.mrp} quantity={item.quantity} />
      </View>)}
      <View style={s.between}>
        <Text style={s.small}>
          {dateLabel(order.date)} ·{" "}
          {order.items.reduce((sum, i) => sum + i.quantity, 0)} packs
        </Text>
        <Text style={s.label}>{money(order.total)}</Text>
      </View>
      {order.eta && (
        <Text style={[s.small, { color: colors.primary }]}>{order.eta}</Text>
      )}
      {order.sample && <Text style={s.small}>Sample order</Text>}
    </Pressable>
  );
}
