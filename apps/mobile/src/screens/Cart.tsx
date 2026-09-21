import React, { useRef, useState } from "react";

import { Text, View } from "react-native";

import { useApp } from "../services/Provider";

import { Media } from "../services/types";

import { useNav } from "../navigation/types";

import { styles as s } from "../theme";

import {

  Badge,

  Button,

  Empty,

  ErrorText,

  Loading,

  money,

  Notice,

  Quantity,

  Screen,

  useAction,

  useAsync,

} from "../components/ui";

import { cartFeedback, orderPlacedFeedback } from "../components/Success";

import { PhotoPicker } from "../components/PhotoPicker";



export function CartScreen() {

  const { services, user, refresh, revision, cartReview, setCartReview } = useApp();

  const nav = useNav();

  const action = useAction();

  const cartAction = useAction();



  const [prescription, setPrescription] = useState<Media>();

  const retained = useRef(false);

  const [picking, setPicking] = useState(false);

  const {

    data: lines,

    error,

    loading,

    setData: setLines,

  } = useAsync(

    async () =>

      Promise.all(

        (await services.cart.list()).map(async (line) => ({

          ...line,

          medicine: await services.medicine.get(line.medicineId),

        })),

      ),

    [services, revision],

  );

  const required = lines?.some((line) => line.medicine.prescriptionRequired);

  const updateQuantity = (id: string, quantity: number) => cartAction.run(async () => {



      await services.cart.setQuantity(id, quantity);

      cartFeedback();

      setLines(current => current?.flatMap(line => line.medicineId !== id ? [line] : quantity ? [{ ...line, quantity }] : []));

      await refresh();

  });

  if (loading && !lines) return <Loading />;

  return (

    <Screen>

      <Text style={s.title}>Your care basket</Text>

      <Text style={s.text}>

        Review your medicines before sending your order.

      </Text>

      <ErrorText error={error} />

      {cartReview && <View style={s.card}>

        <Text style={s.heading}>Review repeat order</Text>

        <Text style={s.small}>Order ID: {cartReview.orderId}</Text>

        <Text style={s.text}>Available items use current prices. Matching cart quantities were set to this order; other cart items were kept.</Text>

        {cartReview.unavailable.map(name => <Text key={name} style={s.error}>{name} — unavailable, not added.</Text>)}

        {cartReview.available.filter(item => item.previousPrice !== item.currentPrice).map(item => <Text key={item.medicineId} style={s.text}>{item.name}: price changed from {money(item.previousPrice)} to {money(item.currentPrice)} per pack.</Text>)}

      </View>}

      {!lines?.length ? (

        <>

          <Empty

            title="Your cart is empty"

            detail="Add medicines to get started."

          />

          <Button

            title="Browse medicines"

            onPress={() => nav.navigate("Tabs", { screen: "Medicines" })}

          />

        </>

      ) : (

        <>

          <View style={s.card}>

            <View style={s.between}>

              <Text style={s.heading}>Estimated total</Text>

              <Text style={s.heading}>

                {money(

                  lines.reduce(

                    (sum, line) => sum + line.quantity * line.medicine.price,

                    0,

                  ),

                )}

              </Text>

            </View>

            <Text style={s.small}>

              No online payment. Final availability and any delivery charges

              would be confirmed by phone.

            </Text>

          </View>

          {lines.map((line) => (

            <View key={line.medicineId} style={s.card}>

              <Text style={s.heading}>{line.medicine.brandName}</Text>

              <Text style={s.text}>

                {line.medicine.strength} · {line.medicine.packageSize}

              </Text>

              {line.medicine.prescriptionRequired && (

                <Badge text="Prescription Required" warning />

              )}

              <Text style={s.label}>{money(line.medicine.price)} per pack</Text>

              <View

                style={{ opacity: 1 }}

              >

                <Quantity

                  value={line.quantity}

                  minimum={0}

                  productName={line.medicine.brandName}

                  disabled={action.busy || cartAction.busy}

                  onChange={(n) => updateQuantity(line.medicineId, n)}

                />

              </View>

              <View style={s.between}>

                <Text style={s.heading}>

                  {money(line.quantity * line.medicine.price)}

                </Text>

                <Button

                  title="Remove"

                  dimDisabled={false}

                  secondary

                  accessibilityLabel={`Remove ${line.medicine.brandName}`}

                  disabled={action.busy || cartAction.busy}

                  onPress={() => updateQuantity(line.medicineId, 0)}

                />

              </View>

            </View>

          ))}

          <View style={s.card}>

            <Text style={s.heading}>Deliver to {user?.name}</Text>

            <Text style={s.text}>

              {user?.address}, {user?.locality}

            </Text>

            <Text style={s.small}>Landmark: {user?.landmark}</Text>

            <Button

              title="Edit delivery address"

              secondary

              onPress={() => nav.navigate("Account")}

            />

          </View>

          {required && (

            <View style={s.section}>

              <Text style={s.heading}>Add your prescription</Text>

              <Notice>

                Required for one or more medicines in your cart. Your pharmacy

                team would review it before confirmation.

              </Notice>

              <PhotoPicker

                value={prescription}

                onChange={setPrescription}

                allowFile

                retainedRef={retained}

                disabled={action.busy}

                onBusyChange={setPicking}

              />

            </View>

          )}

          <Button

            title={action.busy ? "Submitting…" : "Place order"}
            dimDisabled={action.busy || picking || (!!required && !prescription)}

            disabled={action.busy || cartAction.busy || picking || (!!required && !prescription)}

            onPress={() =>

              action.run(async () => {

                const order = await services.order.place(

                  required ? prescription : undefined,

                );

                retained.current = !!required;
                orderPlacedFeedback();

                await refresh();

                setCartReview(undefined);

                nav.replace("Order", { id: order.id, placed: true });

              })

            }

          />

        </>

      )}

      <ErrorText error={action.error} />

      <ErrorText error={cartAction.error} />

    </Screen>

  );

}
